# German fastText vectors for Linxikon

Source model: Meta / Facebook AI Research fastText **cc.de.300**, text vector export, trained on Common Crawl and Wikipedia.

- Model documentation and license: https://fasttext.cc/docs/en/crawl-vectors.html
- Source: https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.de.300.vec.gz
- License: Creative Commons Attribution-ShareAlike 3.0, https://creativecommons.org/licenses/by-sa/3.0/
- Authors: Edouard Grave, Piotr Bojanowski, Prakhar Gupta, Armand Joulin, Tomas Mikolov. *Learning Word Vectors for 157 Languages*, LREC 2018, https://arxiv.org/abs/1802.06893.

Modifications: select supported words from the first 600,000 source rows (source frequency order), normalize casing to lowercase using the first observed source spelling, subtract the mean and remove the three leading principal components fitted on the first 15,500 accepted entries, normalize and quantize the retained 300-dimensional vectors to signed int8 per row. No retraining, no manually assigned similarity values. Derivative vector data is distributed under CC BY-SA 3.0. See manifest.json for shard hashes, dimensions, vocabulary and processing version.

The text export supplies vectors for known words. This browser subset does not include the large binary model's subword matrices and therefore cannot synthesize vectors for unseen words. Selection metadata and the vocabulary also derive from OpenThesaurus and wordfreq; see ../OPENTHESAURUS-LICENSE.txt and ../WORDFREQ-NOTICE.md for their CC BY-SA 4.0 terms. These data licenses do not change the separate source-code license.
