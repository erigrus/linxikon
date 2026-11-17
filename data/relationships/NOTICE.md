# German relationship resources for Semantio

These are separate linguistic databases consumed alongside the fastText vectors.
They are not a list of manually patched word pairs.

## forms.json — inflections and base forms

Source: German lemmatization list, Michal Boleslav Měchura and contributors,
https://github.com/michmech/lemmatization-lists
https://raw.githubusercontent.com/michmech/lemmatization-lists/master/lemmatization-de.txt

License: Open Database License 1.0 (ODbL), https://opendatacommons.org/licenses/odbl/1-0/.
The adapted database forms.json is offered under the same ODbL 1.0 license.
See LICENSE-ODbL-1.0.txt. Underlying source credits include Daniel Naber's Deutsches
Morphologie-Lexikon and the sources listed in the upstream README.

Changes: retain dictionary-attested forms covered by the shipped fastText vocabulary,
respect the original source spelling/capitalization, require compatible casing and
vector corroboration, resolve lemma chains, encode groups as vocabulary indices,
and preserve additional dictionary base forms when only an inflection has a vector.
The complete adapted database and transformation script are provided in this repository.

## families.json — derivational word families

Source: DErivCELEX v2, Institute for Natural Language Processing (IMS), University of
Stuttgart. Elnaz Shafaei, Diego Frassinelli, Gabriella Lapesa and Sebastian Padó (2017),
DErivCELEX: Development and Evaluation of a German Derivational Morphology Lexicon
based on CELEX.

https://www.ims.uni-stuttgart.de/forschung/ressourcen/lexika/derivbase/
https://www.ims.uni-stuttgart.de/documents/ressourcen/lexika/derivbase/derivcelex-v2.txt

License: CC BY-SA 3.0, https://creativecommons.org/licenses/by-sa/3.0/.
Changes: filter to supported lemmas and fold known inflections. Adaptation remains
CC BY-SA 3.0. Full license: ../fasttext/LICENSE-CC-BY-SA-3.0.txt.

## synonyms.json — dictionary synonym groups

Source: OpenThesaurus, © Daniel Naber and contributors, export 2026-11-15,
https://www.openthesaurus.de. License: CC BY-SA 4.0.
Changes: filter the already adapted vocabulary to supported concepts and fold
inflections. Adaptation remains CC BY-SA 4.0. See ../OPENTHESAURUS-LICENSE.txt.

## calibration.json — per-word local density

Derived from the shipped Meta fastText cc.de.300 vectors: local similarity cutoff
at the 120th neighbour among 12,000 frequent dictionary concepts, clipped to
0.22–0.30. CC BY-SA 3.0. Authors, source and full license: ../fasttext/NOTICE.md.

Build process: scripts/build-relationships.py. Resource hashes and vocabulary
identity are recorded in manifest.json. These database licenses are separate from
the source-code license.
