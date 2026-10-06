// Trojan horse page data, built by scripts/build_trojanhorse_data.py (do not edit by hand).
// masses: nuclear masses (MeV) from AME2020, keyed "Z,A"; cases: the measured cases and their published
// numbers, each with its source (refs). See the script for what each field means.
window.THM_DATA = {
 "masses": {
  "0,1": 939.56542,
  "1,1": 938.272075,
  "1,2": 1875.612929,
  "1,3": 2808.921119,
  "2,4": 3727.379328,
  "3,6": 5601.518498,
  "4,7": 6534.183719,
  "5,10": 9324.43664,
  "6,12": 11174.863235,
  "7,14": 13040.203858,
  "7,15": 13968.935982,
  "8,18": 16762.023036,
  "10,20": 18617.730127
 },
 "refs": {
  "lei26": "J. Lei, Phys. Rev. C 114, 034606 (2026), arXiv:2605.16890",
  "spit14": "C. Spitaleri et al., Phys. Rev. C 90, 035801 (2014), arXiv:1407.4678",
  "li15": "C. Li et al., Phys. Rev. C 92, 025805 (2015), arXiv:1503.08672",
  "tum18": "A. Tumino et al., Nature 557, 687 (2018) (accepted manuscript)",
  "lac09": "M. La Cognata et al., Publ. Astron. Soc. Aust. 26, 237 (2009), arXiv:0909.4716",
  "muk19": "A. M. Mukhamedzhanov and D. Y. Pang, Phys. Rev. C 99, 064618 (2019), arXiv:1806.08828",
  "muk26": "A. M. Mukhamedzhanov, arXiv:2609.04498 (2026)",
  "li26": "C. Li et al., Phys. Lett. B 879, 140675 (2026), arXiv:2609.08819",
  "wang26": "X.-J. Wang et al., arXiv:2609.27375 (2026)",
  "bht18": "C. A. Bertulani, M. S. Hussein and S. Typel, Phys. Lett. B 776, 217 (2018), arXiv:1707.04563",
  "piz14": "R. G. Pizzone et al., Astrophys. J. 786, 112 (2014), arXiv:1403.4909"
 },
 "cases": [
  {
   "id": "10B",
   "label": "¹⁰B(p,α)⁷Be",
   "binary": "<sup>10</sup>B(p,α<sub>0</sub>)<sup>7</sup>Be",
   "measured": "<sup>2</sup>H(<sup>10</sup>B,α<sub>0</sub><sup>7</sup>Be)n",
   "a": [
    1,
    2
   ],
   "x": [
    1,
    1
   ],
   "s": [
    0,
    1
   ],
   "A": [
    5,
    10
   ],
   "c": [
    2,
    4
   ],
   "C": [
    4,
    7
   ],
   "names": {
    "a": "d",
    "x": "p",
    "s": "n",
    "A": "¹⁰B",
    "c": "α",
    "C": "⁷Be",
    "F": "¹¹C*"
   },
   "beam": "A",
   "Eb": 24.5,
   "beamNote": "a 24.5 MeV <sup>10</sup>B beam on a deuterated target: the deuteron, the horse, sits still and the boron runs into it",
   "cut": 30,
   "cutNote": "0 ≤ p<sub>n</sub> ≤ 30 MeV/c kept for the S-factor (Spitaleri et al. 2014)",
   "hulthen": true,
   "widthNote": "measured width of the neutron momentum distribution: 54 ± 5 MeV/c FWHM, at a momentum transfer of 220 MeV/c (Spitaleri et al. 2014)",
   "why": "Boron burns in stars at about 5 million kelvin through (p,α) reactions whose Gamow peak sits near 10 keV, on an s-wave resonance of <sup>11</sup>C (the 8.699 MeV level, J<sup>π</sup> = 5/2<sup>+</sup>). Direct data reach only its high-energy tail.",
   "res": [
    {
     "k": "S(10 keV), Trojan horse, bare",
     "v": "3127 ± 583 MeV b",
     "ref": "spit14"
    },
    {
     "k": "S(10 keV) extrapolated from direct data (their Ref. 10)",
     "v": "2870 ± 500 MeV b",
     "ref": "spit14"
    },
    {
     "k": "screening potential U<sub>e</sub>, THM bare S(E) against direct data",
     "v": "240 ± 200 eV (adiabatic limit 340 eV)",
     "ref": "spit14"
    },
    {
     "k": "normalisation",
     "v": "to an R-matrix description of the direct data, smeared to the THM resolution, over 50 to 100 keV; about 15%",
     "ref": "spit14"
    },
    {
     "k": "energies reached",
     "v": "about 100 keV down to about 5 keV",
     "ref": "spit14"
    }
   ]
  },
  {
   "id": "dd",
   "label": "²H(d,p)³H",
   "binary": "<sup>2</sup>H(d,p)<sup>3</sup>H",
   "measured": "<sup>2</sup>H(<sup>6</sup>Li,pt)<sup>4</sup>He",
   "a": [
    3,
    6
   ],
   "x": [
    1,
    2
   ],
   "s": [
    2,
    4
   ],
   "A": [
    1,
    2
   ],
   "c": [
    1,
    1
   ],
   "C": [
    1,
    3
   ],
   "names": {
    "a": "⁶Li",
    "x": "d",
    "s": "α",
    "A": "d",
    "c": "p",
    "C": "t",
    "F": "⁴He*"
   },
   "beam": "a",
   "Eb": 9.5,
   "beamNote": "a 9.5 MeV <sup>6</sup>Li beam on a deuterated target: <sup>6</sup>Li = α + d carries its deuteron into the target deuteron",
   "cut": 20,
   "cutNote": "|p<sub>s</sub>| < 20 MeV/c kept for the S-factor (Li et al. 2015)",
   "hulthen": false,
   "widthNote": "the α momentum distribution inside <sup>6</sup>Li came out 23 MeV/c wide (FWHM), against 72 MeV/c predicted from a Woods-Saxon α-d bound state; Li et al. relate the narrowing to the momentum transfer, about 133 MeV/c here",
   "why": "d + d fusion runs in the first minutes after the Big Bang and in young stars. Below a few tens of keV the direct data are raised by the electrons of the target, a screening that stellar plasmas do differently.",
   "res": [
    {
     "k": "S<sub>bare</sub>(0), Trojan horse",
     "v": "56.7 ± 2.0 keV b",
     "ref": "li15"
    },
    {
     "k": "U<sub>e</sub>, THM bare S(E) against direct data",
     "v": "13.2 ± 4.3 eV",
     "ref": "li15"
    },
    {
     "k": "U<sub>e</sub> with the earlier <sup>3</sup>He = d + p horse (their Ref. 16)",
     "v": "13.4 ± 0.6 eV",
     "ref": "li15"
    },
    {
     "k": "normalisation",
     "v": "to direct data over E<sub>cm</sub> = 40 to 400 keV, where screening is negligible",
     "ref": "li15"
    }
   ]
  },
  {
   "id": "CC",
   "label": "¹²C + ¹²C",
   "binary": "<sup>12</sup>C(<sup>12</sup>C,α<sub>0</sub>)<sup>20</sup>Ne",
   "measured": "<sup>12</sup>C(<sup>14</sup>N,α<sub>0</sub><sup>20</sup>Ne)<sup>2</sup>H",
   "a": [
    7,
    14
   ],
   "x": [
    6,
    12
   ],
   "s": [
    1,
    2
   ],
   "A": [
    6,
    12
   ],
   "c": [
    2,
    4
   ],
   "C": [
    10,
    20
   ],
   "names": {
    "a": "¹⁴N",
    "x": "¹²C",
    "s": "d",
    "A": "¹²C",
    "c": "α",
    "C": "²⁰Ne",
    "F": "²⁴Mg*"
   },
   "beam": "a",
   "Eb": 30.0,
   "beamNote": "a 30 MeV <sup>14</sup>N beam on a carbon target: <sup>14</sup>N = <sup>12</sup>C + d delivers its <sup>12</sup>C",
   "cut": 80,
   "cutNote": "spectator momenta up to about 80 MeV/c, the limit of the phase space the experiment covered; the <sup>12</sup>C-d bound-state wave number is 181 MeV/c (Tumino et al. 2018)",
   "hulthen": false,
   "widthNote": "the measured deuteron momentum distribution agrees in shape with a Woods-Saxon <sup>12</sup>C-d bound state (V<sub>0</sub> = 54.428 MeV, r<sub>0</sub> = 1.25 fm, a = 0.65 fm), reduced χ<sup>2</sup> = 0.2 (Tumino et al. 2018)",
   "why": "Carbon burning shapes the late life of massive stars and the ignition of superbursts on accreting neutron stars. Direct data had not reached the Gamow peak below 2 MeV, and the reference rate assumed no low-lying resonances.",
   "res": [
    {
     "k": "E<sub>cm</sub> covered (channels α<sub>0,1</sub>, p<sub>0,1</sub>)",
     "v": "2.7 down to 0.8 MeV",
     "ref": "tum18"
    },
    {
     "k": "normalisation",
     "v": "to direct α<sub>1</sub> data at E<sub>cm</sub> = 2.50 to 2.63 MeV",
     "ref": "tum18"
    },
    {
     "k": "total rate / reference (CF88), 1.2 GK",
     "v": "1.18",
     "ref": "tum18"
    },
    {
     "k": "total rate / reference, 0.5 GK",
     "v": "more than 25",
     "ref": "tum18"
    },
    {
     "k": "below 0.4 GK",
     "v": "up to a factor 800",
     "ref": "tum18"
    },
    {
     "k": "status",
     "v": "disputed: see Open questions",
     "ref": "muk19"
    }
   ]
  },
  {
   "id": "18O",
   "label": "¹⁸O(p,α)¹⁵N",
   "binary": "<sup>18</sup>O(p,α)<sup>15</sup>N",
   "measured": "<sup>2</sup>H(<sup>18</sup>O,α<sup>15</sup>N)n",
   "a": [
    1,
    2
   ],
   "x": [
    1,
    1
   ],
   "s": [
    0,
    1
   ],
   "A": [
    8,
    18
   ],
   "c": [
    2,
    4
   ],
   "C": [
    7,
    15
   ],
   "names": {
    "a": "d",
    "x": "p",
    "s": "n",
    "A": "¹⁸O",
    "c": "α",
    "C": "¹⁵N",
    "F": "¹⁹F*"
   },
   "beam": "A",
   "Eb": 54.0,
   "beamNote": "a 54 MeV <sup>18</sup>O beam on a deuterated (CD<sub>2</sub>) target",
   "cut": 50,
   "cutNote": "quasi-free break-up found dominant for p<sub>n</sub> < 50 MeV/c (La Cognata et al. 2009)",
   "hulthen": true,
   "widthNote": "inside p<sub>n</sub> < 50 MeV/c the measured neutron momentum distribution follows the squared Hulthén function (La Cognata et al. 2009)",
   "why": "<sup>18</sup>O(p,α)<sup>15</sup>N decides how much fluorine AGB stars can make. At their temperatures the rate hangs on a resonance at 20 keV whose strength had only been estimated from spectroscopy.",
   "res": [
    {
     "k": "(ωγ), 20 keV resonance, Trojan horse",
     "v": "8.3 (+3.8 −2.6) × 10⁻¹⁹ eV",
     "ref": "lac09"
    },
    {
     "k": "NACRE value, from spectroscopy",
     "v": "6 (+17 −5) × 10⁻¹⁹ eV",
     "ref": "lac09"
    },
    {
     "k": "cross-check, 90 keV resonance",
     "v": "(1.76 ± 0.33) × 10⁻⁷ eV; NACRE (1.6 ± 0.5) × 10⁻⁷ eV",
     "ref": "lac09"
    },
    {
     "k": "normalisation",
     "v": "to the strength of the 144 keV resonance (Becker et al. 1995)",
     "ref": "lac09"
    }
   ]
  }
 ]
};
