import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from engine.analyzer import AnalysisError, analyze, validate_text, validate_language, word_count, validate_tokens, _CAPACITY


CORPUS = [
    'My mother gives me water.', 'She has been reading the book.',
    'The book that I bought yesterday is fascinating.', 'Did she give him water?',
    'Please give me the book.', "I don't think he knows.", 'The book was written by her.',
    'I saw her duck.', 'Visiting relatives can be tiring.', 'They saw the man with a telescope.',
    'The water is cold, but the tea is hot.', 'If it rains, we will stay home.',
    'The children have two books.', 'Water, water everywhere.',
    "I'm looking forward to seeing you.", 'She gave it up.', 'Can you open the window?',
    '🌱 My mother gives me water.', 'Café is a borrowed word.',
    '  My mother  gives me water.  ',
]


class EngineTests(unittest.TestCase):
    def test_shared_language_corpus(self):
        corpus = json.loads((Path(__file__).parent.parent / 'src/data/analysis-corpus.json').read_text())
        for item in corpus:
            with self.subTest(case=item['id']):
                if item['expected'] == 'accepted':
                    validate_language(item['language'], item['text'])
                    if item.get('grammarExpected'):
                        with self.assertRaises(AnalysisError) as error:
                            analyze(item['text'], item['language'])
                        self.assertEqual(error.exception.code, item['grammarExpected'])
                    elif not item.get('limitation'):
                        result = analyze(item['text'], item['language'])
                        self.assertEqual(result['language'], 'en')
                        validate_tokens(item['text'], result['tokens'])
                else:
                    with patch('engine.analyzer._model') as model:
                        with self.assertRaises(AnalysisError) as error:
                            analyze(item['text'], item['language'])
                        self.assertEqual(error.exception.code, item['expected'])
                        model.assert_not_called()

    def test_combining_marks_and_exact_limits(self):
        self.assertEqual(word_count("café l'été 42"), 3)
        for text in ['a' * 500, 'é ' * 50]:
            validate_text(text)
        for text in ['a' * 501, 'é ' * 51]:
            with self.assertRaises(AnalysisError) as error:
                validate_text(text)
            self.assertEqual(error.exception.code, 'TEXT_LIMIT')

    def test_real_model_corpus_has_valid_slices_and_heads(self):
        for text in CORPUS:
            with self.subTest(text=text):
                result = analyze(text)
                validate_tokens(text, result['tokens'])
                self.assertEqual(result['modelVersion'], '3.8.0')
                self.assertEqual(result['license'], 'MIT')

    def test_actual_morphology_dependency_and_contractions(self):
        tokens = analyze('My mother gives me water.')['tokens']
        self.assertEqual(tokens[1]['head'], 3)
        self.assertEqual(tokens[1]['relation'], 'nsubj')
        self.assertEqual(tokens[2]['features']['Person'], '3')
        self.assertEqual(tokens[4]['relation'], 'dobj')  # spaCy, not UD obj
        negation = next(t for t in analyze("I don't think he knows.")['tokens'] if t['text'] == "n't")
        self.assertEqual(negation['features']['Polarity'], 'Neg')
        self.assertEqual((negation['start'], negation['end']), (4, 7))

    def test_astral_offsets_and_repeated_occurrences(self):
        tokens = analyze('🌱 My mother gives me water.')['tokens']
        self.assertEqual((tokens[0]['start'], tokens[0]['end']), (0, 2))
        self.assertEqual((tokens[1]['start'], tokens[1]['end']), (3, 5))
        tokens = analyze('Water, water everywhere.')['tokens']
        self.assertEqual([t['start'] for t in tokens if t['text'].lower() == 'water'], [0, 7])

    def test_multiple_sentences_and_input_boundaries(self):
        with self.assertRaises(AnalysisError) as error:
            analyze('She reads. He listens.')
        self.assertEqual((error.exception.code, error.exception.status), ('MULTIPLE_SENTENCES', 422))
        for text in [None, '', ' ', '\ud800', 'a' * 501, 'word ' * 51, '🌱' * 251]:
            with self.subTest(text=repr(text)), self.assertRaises(AnalysisError):
                analyze(text)

    def test_corrupt_parse_cannot_be_rendered(self):
        text = 'My mother gives me water.'
        original = analyze(text)['tokens']
        for mutation in ['cycle', 'missing_head', 'self_head', 'wrong_text', 'wrong_range', 'two_roots']:
            tokens = copy.deepcopy(original)
            if mutation == 'cycle':
                tokens[0]['head'], tokens[1]['head'] = 2, 1
            elif mutation == 'missing_head': tokens[0]['head'] = 99
            elif mutation == 'self_head': tokens[0]['head'] = 1
            elif mutation == 'wrong_text': tokens[0]['text'] = 'Their'
            elif mutation == 'wrong_range': tokens[0]['end'] = 3
            else: tokens[0]['head'] = 0
            with self.subTest(mutation=mutation), self.assertRaises(AnalysisError):
                validate_tokens(text, tokens)

    def test_saturation_is_bounded_and_failure_releases_capacity(self):
        _CAPACITY.acquire()
        try:
            with self.assertRaises(AnalysisError) as error: analyze('She reads.')
            self.assertEqual(error.exception.code, 'BUSY')
        finally:
            _CAPACITY.release()
        with patch('engine.analyzer._model', side_effect=RuntimeError('internal')):
            with self.assertRaises(RuntimeError): analyze('She reads.')
        self.assertTrue(analyze('She reads.')['tokens'])


if __name__ == '__main__':
    unittest.main()
