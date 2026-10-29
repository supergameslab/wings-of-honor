import { acesFor, ACES } from './sim/aces.js';
import { makePrologue, mergeProgress, starRating, nextCraftUnlock, nextAceMission } from './sim/progress.js';
export { makePrologue, mergeProgress, starRating, nextCraftUnlock, nextAceMission };

const SAVE_KEY = 'wings-honor-progress';
const MAX_MISSION = 100;

export const DIFFICULTY = {
  easy: {
    id: 'easy',
    label: 'CADET',
    hull: 140,
    damageMul: 0.55,
    enemyHp: 2,
    enemySpeed: 0.84,
    fireInterval: 2.55,
    enemyBonus: 0,
    killBonus: 0,
    targetBonus: 0,
    waveShare: 1,
    aaBonus: 0,
    aaFireInterval: 1.85,
    aaDamage: 5,
    aaRange: 155,
    aaSpread: 0.32,
    convoyMul: 0.82,
  },
  normal: {
    id: 'normal',
    label: 'PILOT',
    hull: 100,
    damageMul: 1,
    enemyHp: 3,
    enemySpeed: 1,
    fireInterval: 2.05,
    enemyBonus: 2,
    killBonus: 0,
    targetBonus: 1,
    waveShare: 0.55,
    aaBonus: 1,
    aaFireInterval: 0.92,
    aaDamage: 8,
    aaRange: 205,
    aaSpread: 0.18,
    convoyMul: 1,
  },
  hard: {
    id: 'hard',
    label: 'ACE',
    hull: 75,
    damageMul: 1.4,
    enemyHp: 4,
    enemySpeed: 1.22,
    fireInterval: 1.35,
    enemyBonus: 3,
    killBonus: 1,
    targetBonus: 2,
    waveShare: 0.5,
    aaBonus: 2,
    aaFireInterval: 0.52,
    aaDamage: 12,
    aaRange: 248,
    aaSpread: 0.09,
    convoyMul: 1.28,
  },
};

export const THEATERS = [
  { id: 'britain', name: 'Battle of Britain', blurb: 'Kent to the Thames, 1940' },
  { id: 'desert', name: 'Desert Storm', blurb: 'North Africa, 1941–1943' },
  { id: 'europe', name: 'Fortress Europe', blurb: 'Western Europe, 1943–1944' },
  { id: 'pacific', name: 'Pacific Thunder', blurb: 'Islands and carriers, 1942–1945' },
  { id: 'final', name: 'Final Offensive', blurb: 'The last year in Europe' },
];

export const MISSIONS = [
  { id: 1, theater: 'britain', name: 'First Patrol', region: 'Kent', terrain: 'fields', weather: 'clear', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'kills', kills: 2 }, brief: 'A quiet sector to get the Spitfire’s measure. Find the two 109s and bring them down over the hop gardens and hedgerows.' },
  { id: 2, theater: 'britain', name: 'Radar Watch', region: 'Poling', terrain: 'fields', weather: 'clear', fighters: 1, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three radar marks along the Chain Home line. Come home with plates, not holes.' },
  { id: 3, theater: 'britain', name: 'Dawn Sweep', region: 'Hawkinge', terrain: 'fields', weather: 'dawn', fighters: 3, targets: 1, targetKind: 'depot', aces: ['wick'], win: { type: 'kills', kills: 3 }, brief: 'The sun is a blade on the Channel. Wick is up with the morning patrol. Intercept them before they reach the balloons.' },
  { id: 4, theater: 'britain', name: 'Airfield Strike', region: 'Manston', terrain: 'fields', weather: 'clear', fighters: 2, targets: 3, targetKind: 'hangar', win: { type: 'targets', targets: 3 }, brief: 'Three hangars on the grass at Manston. Use the hedges for cover, then put your bombs on the roofs.' },
  { id: 5, theater: 'britain', name: 'Broken Weather', region: 'Kenley', terrain: 'fields', weather: 'rain', fighters: 3, targets: 0, targetKind: 'depot', aces: ['molders'], win: { type: 'kills', kills: 3 }, brief: 'Rain rattles the canopy. Mölders is using the weather as a cloak. Hunt by instinct — he will not.' },
  { id: 6, theater: 'britain', name: 'Channel Ambush', region: 'The Channel', terrain: 'coast', weather: 'overcast', fighters: 4, targets: 1, targetKind: 'aa', aces: ['galland'], win: { type: 'kills', kills: 4 }, brief: 'Galland leads them over the water. Stay high, then fall on them — if he lets you.' },
  { id: 7, theater: 'britain', name: 'Grey Veil', region: 'Dover', terrain: 'coast', weather: 'fog', fighters: 3, targets: 1, targetKind: 'depot', aces: ['oesau'], win: { type: 'kills', kills: 3 }, brief: 'Fog sits on the cliffs like wool. Oesau is in it. Trust the radar. Fire only when the silhouette is sure.' },
  { id: 8, theater: 'britain', name: 'Flak Road', region: 'Biggin Hill', terrain: 'fields', weather: 'haze', fighters: 2, targets: 1, targetKind: 'aa', aces: ['lutzow'], win: { type: 'both', kills: 2, targets: 1 }, brief: 'Lützow is chewing the balloon line. Kill the escorts, crater the gun, and do not give him a second pass.' },
  { id: 9, theater: 'britain', name: 'Coastal Eyes', region: 'Pas-de-Calais', terrain: 'coast', weather: 'clear', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three coastal marks on the French side. Fly through each ring and bring the plates home.' },
  { id: 10, theater: 'britain', name: 'Channel Convoy', region: 'The Channel', terrain: 'sea', weather: 'clear', fighters: 2, targets: 3, targetKind: 'ship', win: { type: 'targets', targets: 3 }, brief: 'A small convoy steams east. Put a bomb into each hull before they reach harbour.' },
  { id: 11, theater: 'britain', name: 'Dover Intercept', region: 'Dover', terrain: 'coast', weather: 'rain', fighters: 2, targets: 2, targetKind: 'ship', win: { type: 'both', kills: 1, targets: 2 }, brief: 'Ships hug the mole in the rain. One pass for the fighter, one for the bombs.' },
  { id: 12, theater: 'britain', name: 'North Sea Sweep', region: 'North Sea', terrain: 'sea', weather: 'overcast', fighters: 4, targets: 1, targetKind: 'ship', win: { type: 'kills', kills: 4 }, brief: 'Fighter-bombers are ranging the shipping lanes. Sweep them from the grey water.' },
  { id: 13, theater: 'britain', name: 'Squall Line', region: 'Thames Mouth', terrain: 'sea', weather: 'storm', fighters: 4, targets: 2, targetKind: 'ship', win: { type: 'kills', kills: 4 }, brief: 'A squall walks the estuary. Fight inside it. The ships can wait if the fighters die first.' },
  { id: 14, theater: 'britain', name: 'Manston Sheds', region: 'Manston', terrain: 'coast', weather: 'dusk', fighters: 2, targets: 2, targetKind: 'hangar', win: { type: 'targets', targets: 2 }, brief: 'Hit the dispersal sheds at last light. Come in low over the cliffs and leave smoke behind you.' },
  { id: 15, theater: 'britain', name: 'Kenley Climb', region: 'Kenley', terrain: 'hills', weather: 'clear', fighters: 3, targets: 1, targetKind: 'depot', aces: ['priller'], win: { type: 'both', kills: 2, targets: 1 }, brief: 'Priller holds the hill. Clear him and his fighters, then crater the dump on the saddle. Watch the fuel.' },
  { id: 16, theater: 'britain', name: 'Hold the Sector', region: 'Tangmere', terrain: 'fields', weather: 'storm', fighters: 3, targets: 0, targetKind: 'depot', win: { type: 'survive', seconds: 80, kills: 2 }, brief: 'Hold the sector for eighty seconds. The wind will try to throw you into the trees. Stay alive, and take two with you.' },
  { id: 17, theater: 'britain', name: 'White Cliffs', region: 'Folkestone', terrain: 'coast', weather: 'fog', fighters: 3, targets: 1, targetKind: 'aa', win: { type: 'kills', kills: 3 }, brief: 'Cloud sits on the cliffs. Climb, keep the chalk on your wing, and take the three that hunt the coast.' },
  { id: 18, theater: 'britain', name: 'Biggin Hill', region: 'Biggin Hill', terrain: 'hills', weather: 'overcast', fighters: 4, targets: 0, targetKind: 'depot', win: { type: 'kills', kills: 4 }, brief: 'Four 109s hold the approach. Turn inside them or die on the ridge.' },
  { id: 19, theater: 'britain', name: 'Thames Watch', region: 'Thames Estuary', terrain: 'city', weather: 'dusk', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks down the estuary at dusk. The marshes will hide you if you stay low.' },
  { id: 20, theater: 'britain', name: 'Eagle Attack', region: 'London approaches', terrain: 'city', weather: 'haze', fighters: 3, targets: 2, targetKind: 'hangar', aces: ['galland'], win: { type: 'both', kills: 2, targets: 2 }, brief: 'Galland is covering a raid on the approaches. Kill the escorts, then crater the landing sheds. This is Eagle Day.' },

  { id: 21, theater: 'desert', name: 'Sidi Barrani', region: 'Sidi Barrani', terrain: 'desert', weather: 'heat', fighters: 1, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Posted south. Photograph the coast road. The air is a furnace and the dunes throw hard shadows.' },
  { id: 22, theater: 'desert', name: 'Desert Eyes', region: 'Cyrenaica', terrain: 'desert', weather: 'dust', fighters: 2, targets: 0, targetKind: 'camp', win: { type: 'kills', kills: 2 }, brief: 'Two machines are all they can put up over the sand. Find them above the wadi and bring them down.' },
  { id: 23, theater: 'desert', name: 'Fuel Dump', region: 'Tobruk road', terrain: 'desert', weather: 'heat', fighters: 1, targets: 1, targetKind: 'depot', win: { type: 'targets', targets: 1 }, brief: 'A fuel dump feeds the Afrika Korps. One dump, one pass. Cut that spine.' },
  { id: 24, theater: 'desert', name: 'Airfield Raid', region: 'El Adem', terrain: 'desert', weather: 'dusk', fighters: 2, targets: 1, targetKind: 'hangar', win: { type: 'both', kills: 1, targets: 1 }, brief: 'They will try to cover the sheds at last light. Kill the escort, then finish the field.' },
  { id: 25, theater: 'desert', name: 'Stuka Weather', region: 'Gazala', terrain: 'desert', weather: 'heat', fighters: 2, targets: 2, targetKind: 'aa', aces: ['marseille'], win: { type: 'targets', targets: 2 }, brief: 'Marseille is covering a Stuka line. Dive the guns. Without flak the desert is ours to fly.' },
  { id: 26, theater: 'desert', name: 'Coast Road', region: 'Via Balbia', terrain: 'coast', weather: 'haze', fighters: 2, targets: 0, targetKind: 'camp', win: { type: 'kills', kills: 2 }, brief: 'Two scouts are using the coast road as a rail. Hunt them between the dunes and the sea.' },
  { id: 27, theater: 'desert', name: 'Oasis Column', region: 'Siwa track', terrain: 'desert', weather: 'dust', fighters: 1, targets: 2, targetKind: 'camp', win: { type: 'targets', targets: 2 }, brief: 'German camps sit on the water. The dust hides everything but the roofs. Bomb the bomas and get out.' },
  { id: 28, theater: 'desert', name: 'Benghazi Yards', region: 'Benghazi', terrain: 'town', weather: 'heat', fighters: 2, targets: 1, targetKind: 'depot', win: { type: 'both', kills: 2, targets: 1 }, brief: 'The harbour dump feeds the interior. Clear the two machines, then crater the store.' },
  { id: 29, theater: 'desert', name: 'Jebel Watch', region: 'Jebel Akhdar', terrain: 'hills', weather: 'haze', fighters: 1, targets: 0, targetKind: 'camp', win: { type: 'recon', waypoints: 4 }, brief: 'The column needs eyes. Photograph four marks along the green mountain. Do not get lost in the haze.' },
  { id: 30, theater: 'desert', name: 'Tobruk Heights', region: 'Tobruk', terrain: 'hills', weather: 'heat', fighters: 3, targets: 1, targetKind: 'aa', win: { type: 'kills', kills: 3 }, brief: 'Three machines and a gun hold the heights. Take the air from them.' },
  { id: 31, theater: 'desert', name: 'Sandstorm', region: 'The Wire', terrain: 'desert', weather: 'dust', fighters: 1, targets: 0, targetKind: 'camp', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks in the dust. There is nowhere to hide but the escarpment.' },
  { id: 32, theater: 'desert', name: 'Waterhole', region: 'Bir Hakeim', terrain: 'desert', weather: 'heat', fighters: 1, targets: 2, targetKind: 'camp', win: { type: 'targets', targets: 2 }, brief: 'Concentrations gather at the water. Bomb the camps. Without water they cannot hold the sand.' },
  { id: 33, theater: 'desert', name: 'Desert Railway', region: 'Mersa Matruh', terrain: 'desert', weather: 'dust', fighters: 2, targets: 3, targetKind: 'depot', win: { type: 'targets', targets: 3 }, brief: 'The railway is their spine. Three dumps along the line. Cut it, and the coast withers.' },
  { id: 34, theater: 'desert', name: 'El Alamein Sweep', region: 'El Alamein', terrain: 'desert', weather: 'heat', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'kills', kills: 2 }, brief: 'They have put two machines over the box. In this air the engine boils. Keep the fight short.' },
  { id: 35, theater: 'desert', name: 'Ridge Ambush', region: 'Ruweisat', terrain: 'desert', weather: 'dust', fighters: 2, targets: 2, targetKind: 'camp', aces: ['marseille'], win: { type: 'both', kills: 2, targets: 2 }, brief: 'Camps in the lee of the ridge, two scouts above — and Marseille. Clear the air, then the sand.' },
  { id: 36, theater: 'desert', name: 'Tripoli Station', region: 'Tripoli', terrain: 'town', weather: 'heat', fighters: 2, targets: 2, targetKind: 'depot', win: { type: 'targets', targets: 2 }, brief: 'Tin roofs and a station yard. Bomb the dumps in town and leave the hospital standing.' },
  { id: 37, theater: 'desert', name: 'Last Stand', region: 'Tunis road', terrain: 'desert', weather: 'dusk', fighters: 2, targets: 0, targetKind: 'camp', win: { type: 'survive', seconds: 75, kills: 2 }, brief: 'The last Axis force is being closed. Hold the air seventy-five seconds, take two, and the desert is ours.' },
  { id: 38, theater: 'desert', name: 'Mareth Line', region: 'Mareth', terrain: 'hills', weather: 'haze', fighters: 3, targets: 2, targetKind: 'aa', win: { type: 'both', kills: 2, targets: 2 }, brief: 'Guns on the hills, scouts above the wadi. Silence two pits and two machines.' },
  { id: 39, theater: 'desert', name: 'Cape Bon', region: 'Cape Bon', terrain: 'coast', weather: 'clear', fighters: 2, targets: 2, targetKind: 'ship', win: { type: 'targets', targets: 2 }, brief: 'Evacuation craft off the cape. Sink the two that matter. Reef, haze, and no room to be sloppy.' },
  { id: 40, theater: 'desert', name: 'Tunis Bound', region: 'Tunis', terrain: 'coast', weather: 'overcast', fighters: 3, targets: 0, targetKind: 'camp', aces: ['marseille'], win: { type: 'survive', seconds: 90, kills: 3 }, brief: 'Hold the sector ninety seconds, take three. Marseille will not stand still. The desert does not forgive a late turn.' },

  { id: 41, theater: 'europe', name: 'Channel Crossing', region: 'Pas-de-Calais', terrain: 'coast', weather: 'haze', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks on the French coast. The Channel is a ditch. Do not linger for their guns.' },
  { id: 42, theater: 'europe', name: 'Escort In', region: 'Lille', terrain: 'city', weather: 'overcast', fighters: 3, targets: 0, targetKind: 'depot', aces: ['priller'], win: { type: 'kills', kills: 3 }, brief: 'Priller is turning over Lille. Fight him above the streets while the bombers go in.' },
  { id: 43, theater: 'europe', name: 'Ruhr Smoke', region: 'Ruhr', terrain: 'city', weather: 'haze', fighters: 3, targets: 0, targetKind: 'depot', aces: ['steinhoff'], win: { type: 'kills', kills: 3 }, brief: 'Smoke from the works makes a second sky. Steinhoff owns it. Turn inside the chimneys and bring him down.' },
  { id: 44, theater: 'europe', name: 'Essen Works', region: 'Essen', terrain: 'city', weather: 'overcast', fighters: 2, targets: 3, targetKind: 'depot', win: { type: 'targets', targets: 3 }, brief: 'Three dumps in the industrial grid. Put bombs on the roofs and climb out through the smoke.' },
  { id: 45, theater: 'europe', name: 'Schweinfurt Road', region: 'Schweinfurt', terrain: 'city', weather: 'clear', fighters: 3, targets: 0, targetKind: 'depot', aces: ['rall'], win: { type: 'survive', seconds: 80, kills: 2 }, brief: 'Rall is covering the approaches. Hold the air eighty seconds and take two. The bombers need a hole.' },
  { id: 46, theater: 'europe', name: 'Brest Docks', region: 'Brest', terrain: 'city', weather: 'rain', fighters: 2, targets: 2, targetKind: 'ship', win: { type: 'targets', targets: 2 }, brief: 'Ships in the basin, rain on the quays. Sink the two that are loading. Come in off the Atlantic.' },
  { id: 47, theater: 'europe', name: 'Cologne Spire', region: 'Cologne', terrain: 'city', weather: 'clear', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks over Cologne. The cathedral is a blade. The Rhine is a road.' },
  { id: 48, theater: 'europe', name: 'Mustang Country', region: 'Frankfurt', terrain: 'city', weather: 'haze', fighters: 3, targets: 0, targetKind: 'depot', aces: ['barkhorn'], win: { type: 'kills', kills: 3 }, brief: 'Barkhorn is upstairs. You have the range now. Fight him over the river and do not bleed energy.' },
  { id: 49, theater: 'europe', name: 'Peenemünde', region: 'Peenemünde', terrain: 'coast', weather: 'overcast', fighters: 2, targets: 2, targetKind: 'hangar', win: { type: 'targets', targets: 2 }, brief: 'The rocket sheds sit on the Baltic shore. Two hangars, a town, and water like glass. Burn the sheds.' },
  { id: 50, theater: 'europe', name: 'Rhine Barges', region: 'Rhine', terrain: 'city', weather: 'haze', fighters: 2, targets: 3, targetKind: 'gunboat', win: { type: 'targets', targets: 3 }, brief: 'Barges and a gunboat on the Rhine. Sink the three. The river is a trench with no cover but the bends.' },
  { id: 51, theater: 'europe', name: 'Paris Watch', region: 'Paris', terrain: 'city', weather: 'dusk', fighters: 3, targets: 0, targetKind: 'depot', aces: ['nowotny'], win: { type: 'survive', seconds: 80, kills: 2 }, brief: 'Nowotny is covering a raid. Hold the air eighty seconds and take two. The Seine is your landmark.' },
  { id: 52, theater: 'europe', name: 'Lyon Yards', region: 'Lyon', terrain: 'city', weather: 'overcast', fighters: 2, targets: 3, targetKind: 'depot', win: { type: 'targets', targets: 3 }, brief: 'The marshalling yards feed the Front. Three dumps among the warehouses. Bomb the yards, not the town.' },
  { id: 53, theater: 'europe', name: 'Caen Streets', region: 'Caen', terrain: 'city', weather: 'haze', fighters: 2, targets: 2, targetKind: 'aa', aces: ['priller'], win: { type: 'both', kills: 2, targets: 2 }, brief: 'Priller is above Caen. Flak in the streets. Clear the two machines, then silence the guns on the squares.' },
  { id: 54, theater: 'europe', name: 'Cherbourg Mole', region: 'Cherbourg', terrain: 'coast', weather: 'rain', fighters: 2, targets: 2, targetKind: 'ship', win: { type: 'targets', targets: 2 }, brief: 'Ships in the basin. Sink the two that are loading. Come in off the Channel so the warehouses hide you.' },
  { id: 55, theater: 'europe', name: 'Normandy Dawn', region: 'Omaha', terrain: 'coast', weather: 'dawn', fighters: 3, targets: 2, targetKind: 'aa', win: { type: 'both', kills: 2, targets: 2 }, brief: 'The landings need the guns dead. Come in off the sun. Two pits, two fighters, first light.' },
  { id: 56, theater: 'europe', name: 'Bocage Sweep', region: 'Saint-Lô', terrain: 'fields', weather: 'haze', fighters: 3, targets: 0, targetKind: 'depot', aces: ['baer'], win: { type: 'kills', kills: 3 }, brief: 'Bär is turning over the hedgerows. The bocage will hide a diving 109 until he is in your guns.' },
  { id: 57, theater: 'europe', name: 'Falaise Pocket', region: 'Falaise', terrain: 'fields', weather: 'overcast', fighters: 2, targets: 3, targetKind: 'truck', win: { type: 'targets', targets: 3 }, brief: 'The pocket is a road of lorries. Three columns. Smash them and the army dies in the fields.' },
  { id: 58, theater: 'europe', name: 'Antwerp Docks', region: 'Antwerp', terrain: 'city', weather: 'rain', fighters: 2, targets: 2, targetKind: 'ship', win: { type: 'targets', targets: 2 }, brief: 'The Scheldt is the prize. Two hulls in the roads. Sink them before the guns find you.' },
  { id: 59, theater: 'europe', name: 'Arnhem Bridge', region: 'Arnhem', terrain: 'city', weather: 'haze', fighters: 3, targets: 1, targetKind: 'aa', aces: ['rudorffer'], win: { type: 'both', kills: 2, targets: 1 }, brief: 'Rudorffer is covering the bridge guns. Take two in the air and silence the pit. The river is the next trench.' },
  { id: 60, theater: 'europe', name: 'Wilhelmshaven', region: 'Wilhelmshaven', terrain: 'coast', weather: 'overcast', fighters: 3, targets: 3, targetKind: 'ship', win: { type: 'both', kills: 2, targets: 3 }, brief: 'The fleet’s door. Three hulls in the roads, scouts above. Take two in the air and three on the water.' },

  { id: 61, theater: 'pacific', name: 'Coral Eyes', region: 'Coral Sea', terrain: 'sea', weather: 'clear', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks over the reef. Water like glass, nowhere to hide but the glare.' },
  { id: 62, theater: 'pacific', name: 'Carrier Screen', region: 'The slot', terrain: 'sea', weather: 'haze', fighters: 3, targets: 0, targetKind: 'depot', aces: ['sakai'], win: { type: 'kills', kills: 3 }, brief: 'Sakai is ranging the task force. Three Zeros. Keep them off the deck.' },
  { id: 63, theater: 'pacific', name: 'Island Field', region: 'Guadalcanal', terrain: 'island', weather: 'heat', fighters: 2, targets: 2, targetKind: 'hangar', win: { type: 'targets', targets: 2 }, brief: 'Henderson’s opposite number. Two sheds in the palms. Come in off the water so they see you late.' },
  { id: 64, theater: 'pacific', name: 'The Slot', region: 'New Georgia', terrain: 'island', weather: 'haze', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 4 }, brief: 'Photograph four marks down the Slot. Islands like green coins. Do not get lost in the haze.' },
  { id: 65, theater: 'pacific', name: 'Rabaul Sweep', region: 'Rabaul', terrain: 'island', weather: 'overcast', fighters: 3, targets: 0, targetKind: 'depot', aces: ['nishizawa'], win: { type: 'kills', kills: 3 }, brief: 'The Devil of Rabaul is up. Three machines over the caldera. Turn inside them or die on the water.' },
  { id: 66, theater: 'pacific', name: 'Truk Lagoon', region: 'Truk', terrain: 'sea', weather: 'clear', fighters: 2, targets: 3, targetKind: 'ship', win: { type: 'targets', targets: 3 }, brief: 'The lagoon is a parking lot of steel. Three hulls. Put a bomb in each and climb out over the reef.' },
  { id: 67, theater: 'pacific', name: 'Tarawa Tide', region: 'Tarawa', terrain: 'island', weather: 'heat', fighters: 2, targets: 2, targetKind: 'aa', win: { type: 'both', kills: 2, targets: 2 }, brief: 'Guns on the atoll, Zeros above the lagoon. Silence two pits and two machines.' },
  { id: 68, theater: 'pacific', name: 'Saipan Field', region: 'Saipan', terrain: 'island', weather: 'haze', fighters: 3, targets: 2, targetKind: 'hangar', win: { type: 'targets', targets: 2 }, brief: 'Hit the field before they can put more up. Two hangars, scouts above the cane.' },
  { id: 69, theater: 'pacific', name: 'Philippine Sea', region: 'Philippine Sea', terrain: 'sea', weather: 'clear', fighters: 4, targets: 0, targetKind: 'depot', aces: ['sakai'], win: { type: 'kills', kills: 4 }, brief: 'The turkey shoot begins as a fight. Four machines. Sweep them from the blue.' },
  { id: 70, theater: 'pacific', name: 'Leyte Gulf', region: 'Leyte', terrain: 'sea', weather: 'storm', fighters: 5, targets: 3, targetKind: 'ship', aces: ['nishizawa'], win: { type: 'both', kills: 5, targets: 3 }, brief: 'Nishizawa is in the storm. Their ships, every fighter they have left, and the dark Zero. The sea is your battlefield.' },
  { id: 71, theater: 'pacific', name: 'Iwo Jima Eyes', region: 'Iwo Jima', terrain: 'island', weather: 'overcast', fighters: 2, targets: 0, targetKind: 'depot', win: { type: 'recon', waypoints: 3 }, brief: 'Photograph three marks on the pork-chop island. Sulphur, black sand, and no cover.' },
  { id: 72, theater: 'pacific', name: 'Beachhead', region: 'Peleliu', terrain: 'island', weather: 'heat', fighters: 1, targets: 3, targetKind: 'trench', win: { type: 'targets', targets: 3 }, brief: 'Three traverses of the island defence. Strafe the parapet, bomb the bays. Infantry go in when the trench is broken.' },
  { id: 73, theater: 'pacific', name: 'Flak Nest', region: 'Okinawa', terrain: 'island', weather: 'clear', fighters: 2, targets: 3, targetKind: 'aa', win: { type: 'targets', targets: 3 }, brief: 'A battery is chewing the landing. Dive, crater the pits, and climb out through the black bursts.' },
  { id: 74, theater: 'pacific', name: 'Supply Column', region: 'Luzon', terrain: 'jungle', weather: 'rain', fighters: 1, targets: 4, targetKind: 'truck', win: { type: 'targets', targets: 4 }, brief: 'A motor column is feeding the line. Lorries on the jungle road. Bomb the road. Without petrol they sit in the mud.' },
  { id: 75, theater: 'pacific', name: 'Jungle March', region: 'Bougainville', terrain: 'jungle', weather: 'haze', fighters: 1, targets: 4, targetKind: 'troops', win: { type: 'targets', targets: 4 }, brief: 'A relief is coming up under the canopy. Strafe the column and scatter it before it reaches the airfield.' },
  { id: 76, theater: 'pacific', name: 'Dawn Strafe', region: 'Kwajalein', terrain: 'island', weather: 'dawn', fighters: 2, targets: 3, targetKind: 'trench', win: { type: 'targets', targets: 3 }, brief: 'First light on the atoll. Come in low, guns first, bombs for the strongpoints.' },
  { id: 77, theater: 'pacific', name: 'Battery Silence', region: 'Tinian', terrain: 'island', weather: 'clear', fighters: 2, targets: 4, targetKind: 'aa', aces: ['sakai'], win: { type: 'both', kills: 2, targets: 4 }, brief: 'Sakai is covering a gun line. Kill the two, then put the four pits out.' },
  { id: 78, theater: 'pacific', name: 'Mud Column', region: 'New Guinea', terrain: 'jungle', weather: 'rain', fighters: 2, targets: 3, targetKind: 'truck', win: { type: 'targets', targets: 3 }, brief: 'Lorries axle-deep on the coastal track. They cannot leave the road. One pass for the trucks, one for the sky.' },
  { id: 79, theater: 'pacific', name: 'Second Line', region: 'Okinawa', terrain: 'island', weather: 'dusk', fighters: 2, targets: 4, targetKind: 'trench', win: { type: 'both', kills: 2, targets: 4 }, brief: 'The support line at last light. Clear the two machines, then crater four bays.' },
  { id: 80, theater: 'pacific', name: 'Home Islands Watch', region: 'Kyushu', terrain: 'coast', weather: 'haze', fighters: 3, targets: 0, targetKind: 'depot', aces: ['nishizawa'], win: { type: 'recon', waypoints: 4 }, brief: 'Photograph four marks on the Kyushu coast. Nishizawa may be up. Come home with plates.' },

  { id: 81, theater: 'final', name: 'Ardennes Haze', region: 'Bastogne', terrain: 'hills', weather: 'overcast', fighters: 3, targets: 3, targetKind: 'aa', aces: ['rall'], win: { type: 'both', kills: 2, targets: 3 }, brief: 'Rall is on the ridge with three guns. Take two in the air and silence the battery.' },
  { id: 82, theater: 'final', name: 'Fire Plan', region: 'Hurtgen', terrain: 'hills', weather: 'overcast', fighters: 3, targets: 4, targetKind: 'trench', mix: ['trench', 'aa', 'trench', 'aa'], win: { type: 'both', kills: 2, targets: 4 }, brief: 'Trench and flak together. Strafe the line, bomb the pits, and keep their scouts off your back.' },
  { id: 83, theater: 'final', name: 'Bulge Lorries', region: 'St. Vith', terrain: 'hills', weather: 'haze', fighters: 2, targets: 5, targetKind: 'truck', win: { type: 'targets', targets: 5 }, brief: 'The offensive lives on the road. Five lorries in the haze. Smash the column and the line will move.' },
  { id: 84, theater: 'final', name: 'Remagen Bridge', region: 'Remagen', terrain: 'city', weather: 'dawn', fighters: 2, targets: 4, targetKind: 'aa', win: { type: 'targets', targets: 4 }, brief: 'The Rhine crossing needs the guns dead. Soften four pits. Come in off the sun.' },
  { id: 85, theater: 'final', name: 'Open Road', region: 'Cologne road', terrain: 'fields', weather: 'clear', fighters: 2, targets: 4, targetKind: 'troops', aces: ['baer'], win: { type: 'both', kills: 2, targets: 4 }, brief: 'The retreat is on the roads in daylight. Bär is covering a troop column. Strafe the men, then take him if you can.' },
  { id: 86, theater: 'final', name: 'Gun Line', region: 'Ruhr pocket', terrain: 'city', weather: 'clear', fighters: 2, targets: 4, targetKind: 'aa', win: { type: 'targets', targets: 4 }, brief: 'They have thrown a gun line across the works. Four pits. Dive each one.' },
  { id: 87, theater: 'final', name: 'Canal Lorries', region: 'Dortmund–Ems', terrain: 'fields', weather: 'overcast', fighters: 3, targets: 4, targetKind: 'truck', win: { type: 'both', kills: 2, targets: 4 }, brief: 'Supply is bottled on the canal road. Four lorries, scouts above the poplars. Cut the road.' },
  { id: 88, theater: 'final', name: 'Siegfried Line', region: 'Westwall', terrain: 'hills', weather: 'haze', fighters: 3, targets: 5, targetKind: 'trench', aces: ['steinhoff'], win: { type: 'targets', targets: 5 }, brief: 'Concrete and wire. Steinhoff is above the works. Five bays to bomb open.' },
  { id: 89, theater: 'final', name: 'Berlin Guns', region: 'Berlin approaches', terrain: 'city', weather: 'overcast', fighters: 3, targets: 4, targetKind: 'aa', win: { type: 'both', kills: 2, targets: 4 }, brief: 'Flak in the outskirts, scouts over the roofs. Silence four guns and two machines.' },
  { id: 90, theater: 'final', name: 'Dust Column', region: 'Leipzig road', terrain: 'fields', weather: 'haze', fighters: 2, targets: 5, targetKind: 'truck', win: { type: 'targets', targets: 5 }, brief: 'A motor column in the spring dust. Five lorries. You will see them as a stain on the road.' },
  { id: 91, theater: 'final', name: 'Troop Train Road', region: 'Dresden road', terrain: 'fields', weather: 'clear', fighters: 3, targets: 5, targetKind: 'troops', win: { type: 'both', kills: 2, targets: 5 }, brief: 'They are marching in the open. Five elements of a column, scouts for an umbrella. Break the march.' },
  { id: 92, theater: 'final', name: 'Pursuit', region: 'Open country', terrain: 'fields', weather: 'clear', fighters: 3, targets: 4, targetKind: 'truck', win: { type: 'targets', targets: 4 }, brief: 'The army is running on petrol. Four lorries on the chase roads. Catch them.' },
  { id: 93, theater: 'final', name: 'Elbe Line', region: 'The Elbe', terrain: 'fields', weather: 'overcast', fighters: 4, targets: 4, targetKind: 'trench', aces: ['barkhorn'], win: { type: 'both', kills: 3, targets: 4 }, brief: 'Barkhorn holds a last trench on the river. Three scouts down, four bays cratered.' },
  { id: 94, theater: 'final', name: 'The Oder', region: 'Oder', terrain: 'fields', weather: 'rain', fighters: 3, targets: 4, targetKind: 'truck', mix: ['truck', 'aa', 'truck', 'aa'], win: { type: 'both', kills: 2, targets: 4 }, brief: 'Rain on the Oder. Lorries and flak on the far bank. Cut the road and the guns.' },
  { id: 95, theater: 'final', name: 'Berlin Road', region: 'Seelow', terrain: 'hills', weather: 'haze', fighters: 3, targets: 4, targetKind: 'truck', win: { type: 'both', kills: 2, targets: 4 }, brief: 'The old line is a road again. Four lorries, two scouts. Finish the column.' },
  { id: 96, theater: 'final', name: 'Reichstag Column', region: 'Berlin', terrain: 'city', weather: 'clear', fighters: 3, targets: 4, targetKind: 'troops', aces: ['rall'], win: { type: 'both', kills: 3, targets: 4 }, brief: 'Rall is covering a column trying to leave the city. Strafe the troops, take three in the air.' },
  { id: 97, theater: 'final', name: 'Last Flak', region: 'Berlin', terrain: 'city', weather: 'dusk', fighters: 3, targets: 5, targetKind: 'aa', win: { type: 'targets', targets: 5 }, brief: 'Five pits covering the city at last light. Put them out. After this there is no gun line worth the name.' },
  { id: 98, theater: 'final', name: 'The Retreat', region: 'Elbe crossings', terrain: 'fields', weather: 'overcast', fighters: 4, targets: 5, targetKind: 'truck', mix: ['truck', 'troops', 'truck', 'troops', 'aa'], win: { type: 'both', kills: 3, targets: 5 }, brief: 'Everything that can move is on the road. Lorries, troops, a gun. Break five, take three.' },
  { id: 99, theater: 'final', name: 'All Arms', region: 'The Front', terrain: 'fields', weather: 'haze', fighters: 4, targets: 5, targetKind: 'trench', mix: ['trench', 'aa', 'truck', 'troops', 'aa'], aces: ['barkhorn'], win: { type: 'both', kills: 3, targets: 5 }, brief: 'Trench, flak, lorries, a column — and Barkhorn above it. Low, mean, and thorough.' },
  { id: 100, theater: 'final', name: 'Last Patrol', region: 'The Front', terrain: 'fields', weather: 'storm', fighters: 6, targets: 5, targetKind: 'trench', mix: ['trench', 'aa', 'truck', 'troops', 'aa'], aces: ['hartmann', 'galland'], win: { type: 'both', kills: 5, targets: 5 }, brief: 'The last sortie. Hartmann and Galland in the storm, every fighter they have left, and the ground still fighting. Strafe, bomb, and come home. Fly. Fight. Win.' },
];

export function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
    const difficulty = DIFFICULTY[raw.difficulty] ? raw.difficulty : 'normal';
    const completed = Array.isArray(raw.completed) ? raw.completed.filter((n) => n >= 1 && n <= MAX_MISSION) : [];
    const furthest = completed.length ? Math.max(...completed) : 0;
    const unlocked = Math.max(1, Math.min(MISSIONS.length, Math.max(Number(raw.unlocked) || 1, furthest + 1)));
    const scores = raw.scores && typeof raw.scores === 'object' ? raw.scores : {};
    const craftId = typeof raw.craftId === 'string' ? raw.craftId : 'spitfire';
    const stars = raw.stars && typeof raw.stars === 'object' ? raw.stars : {};
    const onboarded = Boolean(raw.onboarded);
    const ribbons = Array.isArray(raw.ribbons) ? raw.ribbons : [];
    return { difficulty, unlocked, completed, scores, craftId, stars, onboarded, ribbons };
  } catch {
    return { difficulty: 'normal', unlocked: 1, completed: [], scores: {}, craftId: 'spitfire', stars: {}, onboarded: false, ribbons: [] };
  }
}

export function saveProgress(progress) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
}

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id) || MISSIONS[0];
}

export function isCampaignMission(mission) {
  return Boolean(mission && !mission.skirmish && mission.id >= 1 && mission.id <= MAX_MISSION);
}

function pickOne(list, rng) {
  if (!list.length) return null;
  return list[Math.floor(rng() * list.length)];
}

function randInt(lo, hi, rng) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

const QUICK_WEATHER = ['clear', 'dawn', 'dusk', 'haze', 'overcast', 'rain', 'fog'];

export function makeQuickSortie(progress = {}, rng = Math.random) {
  const cap = Math.max(1, Math.min(MAX_MISSION, progress.unlocked || 1));
  const unlocked = MISSIONS.filter((m) => m.id <= cap);
  const theaters = [...new Set(unlocked.map((m) => m.theater))];
  const terrains = [...new Set(unlocked.map((m) => m.terrain))];
  const weathers = [...new Set(unlocked.map((m) => m.weather))];
  const kinds = [...new Set(unlocked.map((m) => m.targetKind).filter(Boolean))];
  const regions = [...new Set(unlocked.map((m) => m.region))];
  const winTypes = [...new Set(unlocked.map((m) => m.win?.type).filter(Boolean))];
  const theater = pickOne(theaters, rng) || 'britain';
  const fromTheater = unlocked.filter((m) => m.theater === theater);
  const terrain = pickOne(fromTheater.map((m) => m.terrain), rng) || pickOne(terrains, rng) || 'fields';
  const region = pickOne(fromTheater.map((m) => m.region), rng) || pickOne(regions, rng) || 'Kent';
  const weather = pickOne(weathers.length > 1 ? weathers : QUICK_WEATHER, rng) || 'clear';
  const type = pickOne(winTypes.length ? winTypes : ['kills'], rng) || 'kills';
  const kind = pickOne(kinds.length ? kinds : ['depot'], rng) || 'depot';
  const maxFight = Math.min(6, 3 + Math.floor(cap / 16));
  let fighters = randInt(2, maxFight, rng);
  let targets = 0;
  let mix;
  const win = { type };
  let name = 'Patrol Clash';
  let brief = `A thrown-together patrol over ${region}. ${fighters} machines up. No staff map, just the sky.`;

  if (type === 'kills') {
    win.kills = fighters;
  } else if (type === 'targets') {
    fighters = randInt(1, Math.min(3, maxFight), rng);
    targets = randInt(2, 5, rng);
    win.targets = targets;
    name = kind === 'truck' ? 'Convoy Hunt'
      : kind === 'troops' ? 'Column Strike'
      : kind === 'aa' ? 'Flak Sweep'
      : kind === 'trench' ? 'Trench Strafe'
      : kind === 'ship' || kind === 'gunboat' || kind === 'boat' ? 'Sea Strike'
      : kind === 'hangar' ? 'Shed Raid'
      : 'Ground Raid';
    brief = `Quick orders: crater the ${targetNoun({ targetKind: kind, mix })} at ${region}. ${fighters ? `${fighters} scouts covering.` : 'The air looks empty. It will not stay that way.'}`;
  } else if (type === 'both') {
    fighters = randInt(2, Math.min(4, maxFight), rng);
    targets = randInt(2, 4, rng);
    win.kills = Math.min(fighters, randInt(1, fighters, rng));
    win.targets = targets;
    name = 'Combined Arms';
    brief = `Fighters and ground in the same breath over ${region}. Take ${win.kills} in the air and smash ${targets} below.`;
  } else if (type === 'recon') {
    fighters = randInt(1, Math.min(3, maxFight), rng);
    win.waypoints = randInt(3, 5, rng);
    name = 'Photo Run';
    brief = `Photograph ${win.waypoints} marks over ${region} and bring the plates home. ${fighters} scouts may try to spoil the run.`;
  } else if (type === 'survive') {
    fighters = randInt(2, Math.min(4, maxFight), rng);
    win.seconds = randInt(60, 90, rng);
    win.kills = randInt(1, Math.min(3, fighters), rng);
    name = 'Hold the Sector';
    brief = `Hold ${region} for ${win.seconds} seconds and take ${win.kills}. Weather will not wait.`;
  }

  const mixPool = kinds.filter((k) => ['trench', 'aa', 'truck', 'troops', 'depot'].includes(k));
  if ((type === 'targets' || type === 'both') && targets >= 3 && mixPool.length >= 2) {
    mix = Array.from({ length: targets }, (_, i) => mixPool[i % mixPool.length]);
  }

  let aces;
  if (cap >= 3 && rng() < (cap >= 50 ? 0.34 : 0.2)) {
    aces = [ACES[Math.floor(rng() * ACES.length)].id];
    if (type === 'kills') name = 'Ace Duel';
    brief += ` Intelligence: ${aceCall(aces[0])} is in the sector.`;
  }

  return {
    id: 0,
    seed: 10000 + Math.floor(rng() * 90000),
    skirmish: true,
    theater,
    name,
    region,
    terrain,
    weather,
    fighters,
    targets,
    targetKind: kind,
    mix,
    aces,
    win,
    brief,
  };
}

function aceCall(id) {
  const ace = ACES.find((a) => a.id === id);
  return ace ? `${ace.name} — ${ace.callsign}` : 'a named ace';
}

const FUEL_THEATERS = new Set(['desert', 'europe', 'pacific', 'final']);

export function usesFuel(mission, difficulty = 'normal') {
  if (!mission || mission.skirmish || mission.onboard || mission.huntPractice) return false;
  if (difficulty === 'easy') return false;
  if (!isCampaignMission(mission)) return false;
  if (mission.terrain === 'sea') return false;
  return FUEL_THEATERS.has(mission.theater) || (mission.id || 0) >= 15;
}

export function fighterCount(mission, difficulty) {
  return Math.max(1, (mission.fighters || 0) + (DIFFICULTY[difficulty]?.enemyBonus || 0));
}

export function targetCount(mission, difficulty) {
  const n = mission.targets || 0;
  if (n <= 0) return 0;
  return n + (DIFFICULTY[difficulty]?.targetBonus || 0);
}

export function winFor(mission, difficulty = 'normal') {
  if (mission.huntPractice) {
    return { type: 'kills', kills: huntFighterCount(mission, difficulty, mission.huntPilots || 1) };
  }
  const w = { ...(mission.win || {}) };
  const nFight = fighterCount(mission, difficulty);
  if (w.type === 'kills' || w.type === 'both') w.kills = nFight;
  else if (w.kills) w.kills = Math.min(nFight, w.kills + (DIFFICULTY[difficulty]?.killBonus || 0));
  if (w.targets) w.targets = targetCount(mission, difficulty);
  return w;
}

export function huntFighterCount(mission, difficulty, pilots = 2) {
  const base = fighterCount(mission, difficulty);
  const extra = Math.max(0, (Number(pilots) || 1) - 1) * 4;
  return Math.min(16, Math.max(8, base + 5 + extra));
}

export function describeWin(mission, difficulty = 'normal') {
  const w = winFor(mission, difficulty);
  if (w.type === 'kills') return `Shoot down ${w.kills} fighter${w.kills === 1 ? '' : 's'}`;
  if (w.type === 'targets') return `Destroy ${w.targets} ${targetNoun(mission)}`;
  if (w.type === 'both') return `Shoot down ${w.kills} and destroy ${w.targets}`;
  if (w.type === 'recon') return `Fly through ${w.waypoints} recon rings`;
  if (w.type === 'survive') return `Hold for ${w.seconds}s and take ${w.kills} kills`;
  return 'Complete the sortie';
}

export function bombingMission(mission) {
  const w = mission?.win || {};
  return w.type === 'targets' || w.type === 'both' || (w.targets || 0) > 0;
}

export function targetNoun(mission) {
  const mix = mission.mix;
  if (mix && mix.length > 1) return 'ground targets';
  const k = mission.targetKind;
  if (k === 'ship' || k === 'gunboat' || k === 'boat') return k === 'gunboat' ? 'warships' : k === 'boat' ? 'boats' : 'ships';
  if (k === 'wireless') return 'radar masts';
  if (k === 'camp') return 'camps';
  if (k === 'hangar') return 'hangars';
  if (k === 'aa') return 'flak batteries';
  if (k === 'truck') return 'vehicle convoys';
  if (k === 'troops') return 'troop columns';
  if (k === 'trench') return 'trench works';
  return 'ground targets';
}

export function weatherLabel(weather) {
  return {
    clear: 'Clear skies',
    haze: 'Morning haze',
    overcast: 'Overcast',
    rain: 'Rain',
    fog: 'Fog',
    storm: 'Storm',
    dusk: 'Dusk',
    dawn: 'Dawn',
    heat: 'Hard heat',
    dust: 'Dust storm',
  }[weather] || weather;
}

export function terrainLabel(terrain) {
  return {
    fields: 'Open fields',
    hills: 'Rolling hills',
    mountains: 'Mountains',
    coast: 'Coastline',
    sea: 'Open sea',
    desert: 'Desert',
    savanna: 'Savanna',
    jungle: 'Jungle',
    town: 'Town',
    city: 'City',
    lake: 'Lake shore',
    island: 'Island',
  }[terrain] || terrain;
}

export function theaterLabel(id) {
  return THEATERS.find((t) => t.id === id)?.name || id;
}

function rand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function cityAnchor(mission) {
  const s = Math.max(1, ((mission.seed || mission.id) * 31 + (mission.region || '').length * 17 + String(mission.theater || 'x').charCodeAt(0)) | 0);
  const k = (i, span) => ((s * (3 + i * 2)) % (span * 2 + 1)) - span;
  return { x: k(1, 7) * 16, z: k(2, 6) * 15 };
}

export function layoutFor(mission, difficulty, opts = {}) {
  const seed = mission.seed || mission.id;
  const rng = rand(seed * 9176 + difficulty.length * 13 + String(mission.theater || '').length * 41 + (opts.pilotCount || 0) * 19);
  const spec = DIFFICULTY[difficulty] || DIFFICULTY.normal;
  let fighters = opts.pilotCount ? huntFighterCount(mission, difficulty, opts.pilotCount) : fighterCount(mission, difficulty);
  if (mission.skirmish && !mission.huntPractice && (spec.waveShare || 1) < 1) {
    fighters = Math.max(fighters, difficulty === 'hard' ? 6 : 5);
  }
  const enemies = [];
  const pattern = fighters >= 8 ? 1 : seed % 4;
  for (let i = 0; i < fighters; i++) {
    let angle;
    let dist;
    const wave = Math.floor(i / 4);
    if (pattern === 0) {
      const t = fighters === 1 ? 0.4 : i / Math.max(1, fighters - 1);
      angle = -1.1 + t * 3.4 + (rng() - 0.5) * 0.4;
      dist = 90 + rng() * 70 + i * 16;
    } else if (pattern === 1) {
      angle = (i / fighters) * Math.PI * 2 + rng() * 0.35 + wave * 0.4;
      dist = 80 + rng() * 110 + wave * 45;
    } else if (pattern === 2) {
      angle = Math.PI * 0.15 + i * 0.55 + (rng() - 0.5) * 0.2;
      dist = 110 + i * 28 + rng() * 30;
    } else {
      angle = Math.PI + (i - (fighters - 1) / 2) * 0.7 + (rng() - 0.5) * 0.25;
      dist = 85 + rng() * 90;
    }
    enemies.push({
      x: Math.sin(angle) * dist,
      agl: 16 + rng() * 18 + wave * 6,
      z: -Math.cos(angle) * dist,
      heading: angle + Math.PI * (rng() > 0.5 ? 0.35 : -0.35),
      wave: 0,
    });
  }
  acesFor(mission, opts).forEach((id, i) => {
    if (enemies[i]) enemies[i].ace = id;
  });
  const share = spec.waveShare ?? 1;
  const winType = mission.win?.type;
  const splitWaves = share < 1 && fighters >= 5 && (winType === 'kills' || winType === 'both' || Boolean(opts.pilotCount) || mission.huntPractice);
  if (splitWaves) {
    enemies.forEach((e, i) => {
      e.wave = i < 3 ? 0 : 1;
    });
  }
  const targets = [];
  const nT = targetCount(mission, difficulty);
  const seaFight = mission.terrain === 'sea' || mission.targetKind === 'ship' || mission.targetKind === 'gunboat' || mission.targetKind === 'boat';
  const kindAt = (i) => {
    const mix = mission.mix;
    if (mix && mix.length) return mix[i % mix.length];
    return mission.targetKind;
  };
  const pushTarget = (t) => {
    targets.push({ role: 'primary', heading: 0, speed: 0, ...t });
  };
  if (nT && seaFight && mission.terrain === 'city') {
    const heading = 0.35 + ((mission.seed || mission.id) % 5) * 0.18;
    const origin = cityAnchor(mission);
    const cx = origin.x;
    const cz = origin.z;
    for (let i = 0; i < nT; i++) {
      const along = (i - (nT - 1) / 2) * (28 + rng() * 10);
      let kind = kindAt(i);
      if (nT >= 3 && i % 3 === 1) kind = 'boat';
      pushTarget({
        x: cx + Math.sin(heading) * along,
        z: cz - Math.cos(heading) * along,
        kind,
      });
    }
  } else if (nT && seaFight) {
    const heading = rng() * Math.PI * 2;
    const cx = (rng() - 0.5) * 90;
    const cz = -70 - rng() * 80;
    for (let i = 0; i < nT; i++) {
      const along = (i - (nT - 1) / 2) * (34 + rng() * 12);
      const side = (rng() - 0.5) * 22;
      let kind = kindAt(i);
      if (nT >= 3 && i > 0) {
        if (i % 3 === 1) kind = 'boat';
        else if (i % 3 === 2) kind = mission.targetKind === 'gunboat' ? 'ship' : 'gunboat';
      }
      pushTarget({
        x: cx + Math.sin(heading) * along + Math.cos(heading) * side,
        z: cz - Math.cos(heading) * along + Math.sin(heading) * side,
        kind,
      });
    }
  } else if (nT && mission.terrain === 'city') {
    const origin = cityAnchor(mission);
    const ox = origin.x;
    const oz = origin.z;
    for (let i = 0; i < nT; i++) {
      const ang = (i / nT) * Math.PI * 2 + rng() * 0.4;
      const dist = 28 + rng() * 50;
      pushTarget({
        x: ox + Math.cos(ang) * dist,
        z: oz + Math.sin(ang) * dist,
        kind: kindAt(i),
      });
    }
  } else if (nT) {
    const primaryKind = kindAt(0);
    const convoy = primaryKind === 'truck' || primaryKind === 'troops';
    const trenchLine = primaryKind === 'trench' || (mission.mix && mission.mix.includes('trench'));
    if (convoy || trenchLine) {
      const heading = rng() * Math.PI * 2;
      const cx = (rng() - 0.5) * 90;
      const cz = -80 - rng() * 90;
      const spacing = primaryKind === 'troops' ? 15 : primaryKind === 'trench' ? 34 : 22;
      for (let i = 0; i < nT; i++) {
        const kind = kindAt(i);
        const along = (i - (nT - 1) / 2) * spacing;
        const side = (rng() - 0.5) * (kind === 'aa' ? 28 : 8);
        const moving = kind === 'truck' || kind === 'troops';
        pushTarget({
          x: cx + Math.sin(heading) * along + Math.cos(heading) * side,
          z: cz - Math.cos(heading) * along + Math.sin(heading) * side,
          kind,
          heading,
          speed: moving ? (kind === 'troops' ? 5.1 : 11) * (spec.convoyMul || 1) : 0,
        });
      }
    } else {
      for (let i = 0; i < nT; i++) {
        const ang = rng() * Math.PI * 2;
        const dist = 70 + rng() * 170;
        pushTarget({
          x: Math.sin(ang) * dist,
          z: -Math.cos(ang) * dist * (0.6 + rng() * 0.5),
          kind: kindAt(i),
          heading: ang,
        });
      }
    }
  }
  const threatAa = spec.aaBonus || 0;
  const groundFight = !seaFight && (nT > 0 || mission.targetKind === 'aa' || mission.targetKind === 'trench');
  if (threatAa && groundFight) {
    const origin = targets[0] || { x: 0, z: -120 };
    for (let i = 0; i < threatAa; i++) {
      const ang = rng() * Math.PI * 2;
      const dist = 36 + rng() * 70;
      targets.push({
        x: origin.x + Math.cos(ang) * dist,
        z: origin.z + Math.sin(ang) * dist,
        kind: 'aa',
        role: 'threat',
        heading: ang,
        speed: 0,
      });
    }
  }
  const waypoints = [];
  if (mission.win.type === 'recon') {
    const count = mission.win.waypoints;
    const heading = ((mission.seed || mission.id) % 7) * 0.7 + rng() * 0.5;
    const start = 50 + rng() * 40;
    for (let i = 0; i < count; i++) {
      const along = start + i * (70 + rng() * 25);
      const side = Math.sin(i * 1.3 + (mission.seed || mission.id)) * (30 + rng() * 40);
      waypoints.push({
        x: Math.sin(heading) * along + Math.cos(heading) * side,
        y: 22 + rng() * 20,
        z: -Math.cos(heading) * along + Math.sin(heading) * side,
      });
    }
  }
  return { enemies, targets, waypoints };
}

export function checkWin(mission, { kills, targets, waypoints, elapsed }, difficulty = 'normal') {
  const w = winFor(mission, difficulty);
  if (w.type === 'kills') return kills >= w.kills;
  if (w.type === 'targets') return targets >= w.targets;
  if (w.type === 'both') return kills >= w.kills && targets >= w.targets;
  if (w.type === 'recon') return waypoints >= w.waypoints;
  if (w.type === 'survive') return elapsed >= w.seconds && kills >= w.kills;
  return false;
}

export function statusLine(mission, stats, difficulty = 'normal') {
  const w = winFor(mission, difficulty);
  if (w.type === 'kills') return `Fighters: ${stats.kills} / ${w.kills}`;
  if (w.type === 'targets') return `Targets: ${stats.targets} / ${w.targets}`;
  if (w.type === 'both') return `Fighters: ${stats.kills} / ${w.kills} · Targets: ${stats.targets} / ${w.targets}`;
  if (w.type === 'recon') return `Marks: ${stats.waypoints} / ${w.waypoints}`;
  if (w.type === 'survive') {
    const left = Math.max(0, Math.ceil(w.seconds - stats.elapsed));
    return `Hold: ${left}s · Kills: ${stats.kills} / ${w.kills}`;
  }
  return '';
}
