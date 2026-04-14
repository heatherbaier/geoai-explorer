// ─────────────────────────────────────────────────────────────
//  GeoAI Explorer — Random Forest Data
//  Houston / Harris County flood risk scenario
//  Parcels placed along Buffalo Bayou & Brays Bayou corridors
// ─────────────────────────────────────────────────────────────

const RF_PARCELS = [
  // High risk — close to bayous, high impervious, flat, poor drainage
  { id:1,  dist:35,  imp:82, slope:1, drain:'poor', flood:'YES', lat:29.756, lng:-95.402, neighborhood:'Heights / Buffalo Bayou' },
  { id:2,  dist:20,  imp:78, slope:1, drain:'poor', flood:'YES', lat:29.748, lng:-95.418, neighborhood:'Meyerland / Brays Bayou' },
  { id:3,  dist:15,  imp:91, slope:2, drain:'poor', flood:'YES', lat:29.744, lng:-95.434, neighborhood:'Meyerland' },
  { id:4,  dist:55,  imp:65, slope:3, drain:'poor', flood:'YES', lat:29.752, lng:-95.388, neighborhood:'Montrose / Midtown' },
  { id:5,  dist:28,  imp:88, slope:1, drain:'poor', flood:'YES', lat:29.739, lng:-95.447, neighborhood:'Westbury' },
  { id:6,  dist:10,  imp:74, slope:2, drain:'poor', flood:'YES', lat:29.761, lng:-95.371, neighborhood:'Fifth Ward / White Oak Bayou' },
  // Low risk — far from bayous, lower impervious, better drainage, some slope
  { id:7,  dist:210, imp:22, slope:11, drain:'good', flood:'NO', lat:29.703, lng:-95.538, neighborhood:'Sugar Land' },
  { id:8,  dist:185, imp:18, slope:14, drain:'good', flood:'NO', lat:29.695, lng:-95.558, neighborhood:'Missouri City' },
  { id:9,  dist:320, imp:12, slope:19, drain:'good', flood:'NO', lat:29.682, lng:-95.571, neighborhood:'Stafford' },
  { id:10, dist:260, imp:28, slope:13, drain:'good', flood:'NO', lat:29.721, lng:-95.513, neighborhood:'Pearland (north)' },
  { id:11, dist:170, imp:32, slope:9,  drain:'mod',  flood:'NO', lat:29.712, lng:-95.491, neighborhood:'Friendswood area' },
  { id:12, dist:125, imp:42, slope:7,  drain:'mod',  flood:'NO', lat:29.728, lng:-95.472, neighborhood:'South Houston' },
  // Mixed / boundary cases
  { id:13, dist:88,  imp:58, slope:5,  drain:'mod',  flood:'YES', lat:29.733, lng:-95.460, neighborhood:'Sunnyside' },
  { id:14, dist:105, imp:52, slope:6,  drain:'mod',  flood:'NO',  lat:29.741, lng:-95.453, neighborhood:'Gulfgate' },
  { id:15, dist:72,  imp:68, slope:4,  drain:'poor', flood:'YES', lat:29.745, lng:-95.443, neighborhood:'South Park' },
];

// ─────────────────────────────────────────────────────────────
//  Three pre-built trees — each trained on a different random
//  subsample of 10 parcels, using a different first split.
//  Represented as nested decision objects for easy traversal.
//
//  Node schema:
//    { feat, thresh, cat, left, right }  ← decision node
//    { label }                            ← leaf node
// ─────────────────────────────────────────────────────────────

function traverse(node, parcel) {
  if (node.label) return node.label;
  const val = { dist: parcel.dist, imp: parcel.imp, slope: parcel.slope, drain: parcel.drain }[node.feat];
  const goLeft = node.cat ? val === node.thresh : val <= node.thresh;
  return traverse(goLeft ? node.left : node.right, parcel);
}

const RF_TREES = [
  {
    id: 1,
    name: 'Tree 1',
    trainedOn: [1,2,3,5,6,7,8,10,13,14],
    firstSplit: 'dist. to stream ≤ 75m',
    color: '#534AB7',
    tree: {
      feat:'dist', thresh:75, cat:false,
      left: {
        feat:'imp', thresh:60, cat:false,
        left:  { label:'LOW RISK'  },   // close but low impervious
        right: { label:'HIGH RISK' }    // close + high impervious
      },
      right: {
        feat:'drain', thresh:'poor', cat:true,
        left:  { label:'HIGH RISK' },   // far but poor drainage
        right: { label:'LOW RISK'  }    // far + mod/good drainage
      }
    }
  },
  {
    id: 2,
    name: 'Tree 2',
    trainedOn: [2,3,4,6,7,9,11,12,13,15],
    firstSplit: 'imp. surface % > 50%',
    color: '#0F6E56',
    tree: {
      feat:'imp', thresh:50, cat:false,
      left: {
        feat:'dist', thresh:150, cat:false,
        left:  { label:'HIGH RISK' },   // low imp but very close
        right: { label:'LOW RISK'  }
      },
      right: {
        feat:'slope', thresh:6, cat:false,
        left:  { label:'HIGH RISK' },   // high imp + flat
        right: { label:'LOW RISK'  }    // high imp but sloped = drains
      }
    }
  },
  {
    id: 3,
    name: 'Tree 3',
    trainedOn: [1,4,5,6,8,9,10,12,14,15],
    firstSplit: 'drainage class = poor',
    color: '#993C1D',
    tree: {
      feat:'drain', thresh:'poor', cat:true,
      left: {
        feat:'imp', thresh:70, cat:false,
        left:  { label:'LOW RISK'  },
        right: { label:'HIGH RISK' }
      },
      right: {
        feat:'dist', thresh:120, cat:false,
        left:  { label:'HIGH RISK' },
        right: { label:'LOW RISK'  }
      }
    }
  }
];

// ─────────────────────────────────────────────────────────────
//  Test parcels for the classification game
//  These are the ones students will classify through each tree
// ─────────────────────────────────────────────────────────────

const RF_TEST_PARCELS = [
  {
    id:'T1',
    dist:42, imp:76, slope:2, drain:'poor',
    flood:'YES',
    lat:29.751, lng:-95.411, neighborhood:'Afton Oaks / Buffalo Bayou',
    hint: 'Close to Buffalo Bayou, heavily paved, flat terrain'
  },
  {
    id:'T2',
    dist:195, imp:24, slope:12, drain:'good',
    flood:'NO',
    lat:29.699, lng:-95.548, neighborhood:'Sugar Land west',
    hint: 'Well outside the bayou corridor, good soil drainage'
  },
  {
    id:'T3',
    dist:68, imp:71, slope:3, drain:'poor',
    flood:'YES',
    lat:29.743, lng:-95.448, neighborhood:'Meyerland edge',
    hint: 'Moderate distance but very high impervious cover and poor drainage'
  },
  {
    id:'T4',
    dist:130, imp:45, slope:8, drain:'mod',
    flood:'NO',
    lat:29.730, lng:-95.465, neighborhood:'Gulfgate / South Houston',
    hint: 'Middle ground — trees might disagree here'
  },
  {
    id:'T5',
    dist:22, imp:55, slope:1, drain:'poor',
    flood:'YES',
    lat:29.755, lng:-95.425, neighborhood:'Washington Ave / White Oak Bayou',
    hint: 'Very close to bayou, flat, poor drainage — but moderate impervious'
  },
];

// Feature display helpers
const FEAT_LABELS = {
  dist:  { label: 'dist. to stream', unit: 'm'  },
  imp:   { label: 'imp. surface %',  unit: '%'  },
  slope: { label: 'slope',           unit: '°'  },
  drain: { label: 'drainage',        unit: ''   },
};
