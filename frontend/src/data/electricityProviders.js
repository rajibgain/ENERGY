export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands',
  'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh',
  'Lakshadweep', 'Puducherry',
];

const utility = (id, name, kind, coverage) => ({ id, name, kind, coverage });

// Principal retail distribution utilities, grouped by their state/UT licensing area.
// Service boundaries can be much smaller than a state; check the consumer bill when unsure.
export const STATE_ELECTRICITY_PROVIDERS = {
  'Andhra Pradesh': [
    utility('apcpdcl', 'Andhra Pradesh Central Power Distribution Company Limited (APCPDCL)', 'State discom', 'Central Andhra Pradesh service area.'),
    utility('apepdcl', 'Andhra Pradesh Eastern Power Distribution Company Limited (APEPDCL)', 'State discom', 'Eastern and north-coastal Andhra Pradesh service area.'),
    utility('apspdcl', 'Andhra Pradesh Southern Power Distribution Company Limited (APSPDCL)', 'State discom', 'Southern Andhra Pradesh and Rayalaseema service area.'),
  ],
  'Arunachal Pradesh': [utility('arpdop', 'Department of Power, Arunachal Pradesh', 'State department', 'State power department distribution areas.' )],
  Assam: [utility('apdcl', 'Assam Power Distribution Company Limited (APDCL)', 'State discom', 'Assam; use the bill to confirm the local subdivision.')],
  Bihar: [
    utility('nbpdcl', 'North Bihar Power Distribution Company Limited (NBPDCL)', 'State discom', 'Northern Bihar service area.'),
    utility('sbpdcl', 'South Bihar Power Distribution Company Limited (SBPDCL)', 'State discom', 'Southern Bihar service area.'),
  ],
  Chandigarh: [utility('chd-electricity', 'Chandigarh Administration · Electricity Department', 'UT department', 'Chandigarh distribution area.')],
  Chhattisgarh: [utility('cspdcl', 'Chhattisgarh State Power Distribution Company Limited (CSPDCL)', 'State discom', 'Most state distribution areas; some industrial licensees have separate service areas.')],
  'Dadra and Nagar Haveli and Daman and Diu': [utility('dnhddpcl', 'DNHDD Power Distribution Corporation Limited', 'UT discom', 'Dadra and Nagar Haveli, Daman and Diu service areas.')],
  Delhi: [
    utility('brpl', 'BSES Rajdhani Power Limited (BRPL)', 'Private urban discom', 'South and west Delhi licensed areas.'),
    utility('bypl', 'BSES Yamuna Power Limited (BYPL)', 'Private urban discom', 'East and central-east Delhi licensed areas.'),
    utility('tpddl', 'Tata Power Delhi Distribution Limited (TPDDL)', 'Private urban discom', 'North and north-west Delhi licensed areas.'),
    utility('ndmc', 'New Delhi Municipal Council (NDMC)', 'Municipal utility', 'NDMC area in central New Delhi.'),
    utility('mes-delhi', 'Military Engineer Services (MES) · Delhi Cantonment', 'Institutional licensee', 'Delhi Cantonment service area.'),
  ],
  Goa: [utility('goa-electricity', 'Electricity Department, Government of Goa', 'State department', 'Goa state distribution area.')],
  Gujarat: [
    utility('ugvcl', 'Uttar Gujarat Vij Company Limited (UGVCL)', 'State discom', 'North Gujarat service area.'),
    utility('mgvcl', 'Madhya Gujarat Vij Company Limited (MGVCL)', 'State discom', 'Central Gujarat service area.'),
    utility('pgvcl', 'Paschim Gujarat Vij Company Limited (PGVCL)', 'State discom', 'Saurashtra and Kutch service area.'),
    utility('dgvcl', 'Dakshin Gujarat Vij Company Limited (DGVCL)', 'State discom', 'South Gujarat service area.'),
    utility('torrent-ahmedabad', 'Torrent Power · Ahmedabad', 'Private urban discom', 'Torrent Power licensed areas in Ahmedabad.'),
    utility('torrent-surat', 'Torrent Power · Surat', 'Private urban discom', 'Torrent Power licensed areas in Surat.'),
  ],
  Haryana: [
    utility('uhbvn', 'Uttar Haryana Bijli Vitran Nigam Limited (UHBVNL)', 'State discom', 'North Haryana service area.'),
    utility('dhbvn', 'Dakshin Haryana Bijli Vitran Nigam Limited (DHBVNL)', 'State discom', 'South Haryana service area.'),
  ],
  'Himachal Pradesh': [utility('hpsebl', 'Himachal Pradesh State Electricity Board Limited (HPSEBL)', 'State utility', 'Himachal Pradesh distribution area.')],
  'Jammu and Kashmir': [
    utility('jpdcl', 'Jammu Power Distribution Corporation Limited (JPDCL)', 'UT discom', 'Jammu region service area.'),
    utility('kpdcl', 'Kashmir Power Distribution Corporation Limited (KPDCL)', 'UT discom', 'Kashmir Valley service area.'),
  ],
  Jharkhand: [
    utility('jbvnl', 'Jharkhand Bijli Vitran Nigam Limited (JBVNL)', 'State discom', 'Most state retail distribution areas.'),
    utility('tata-steel-jamshedpur', 'Tata Steel Limited · Jamshedpur Township', 'Private local discom', 'Jamshedpur township licensed service area.'),
    utility('tsuisl', 'Tata Steel Utilities & Infrastructure Services Limited (TSUISL, formerly JUSCO)', 'Private local discom', 'Seraikela-Kharsawan licensed service area.'),
    utility('bokaro-steel', 'SAIL / Bokaro Steel Plant', 'Industrial discom', 'Bokaro Steel Plant township service area.'),
    utility('dvc-jharkhand', 'Damodar Valley Corporation (DVC)', 'Central statutory utility', 'DVC area; primarily consumers supplied at 33 kV and above.'),
  ],
  Karnataka: [
    utility('bescom', 'Bangalore Electricity Supply Company Limited (BESCOM)', 'State discom', 'Bengaluru and surrounding service area.'),
    utility('hescom', 'Hubli Electricity Supply Company Limited (HESCOM)', 'State discom', 'North-western Karnataka service area.'),
    utility('mescom', 'Mangalore Electricity Supply Company Limited (MESCOM)', 'State discom', 'Coastal Karnataka service area.'),
    utility('gescom', 'Gulbarga Electricity Supply Company Limited (GESCOM)', 'State discom', 'North-eastern Karnataka service area.'),
    utility('cesc-mysore', 'Chamundeshwari Electricity Supply Corporation Limited (CESC)', 'State discom', 'Mysuru and south Karnataka service area.'),
  ],
  Kerala: [utility('kseb', 'Kerala State Electricity Board Limited (KSEB)', 'State utility', 'Kerala distribution area; verify the local section on your bill.')],
  Ladakh: [utility('ladakh-power', 'Power Development Department, Ladakh Administration', 'UT department', 'Ladakh electricity department service areas.')],
  'Madhya Pradesh': [
    utility('mpmk', 'Madhya Pradesh Madhya Kshetra Vidyut Vitran Company Limited (MPMKVVCL)', 'State discom', 'Central Madhya Pradesh service area.'),
    utility('mp-purv', 'Madhya Pradesh Poorv Kshetra Vidyut Vitaran Company Limited (MPPKVVCL)', 'State discom', 'Eastern Madhya Pradesh service area.'),
    utility('mp-paschim', 'Madhya Pradesh Paschim Kshetra Vidyut Vitaran Company Limited (MPWZ)', 'State discom', 'Western Madhya Pradesh service area.'),
  ],
  Maharashtra: [
    utility('msedcl', 'Maharashtra State Electricity Distribution Company Limited (MSEDCL / Mahavitaran)', 'State discom', 'Most of Maharashtra outside separately licensed urban and industrial areas.'),
    utility('best', 'BEST Undertaking', 'Municipal urban discom', 'Parts of Mumbai, including BEST’s licensed island-city areas.'),
    utility('aeml', 'Adani Electricity Mumbai Limited (AEML)', 'Private urban discom', 'Adani Electricity’s licensed areas in Mumbai suburbs.'),
    utility('tata-mumbai', 'The Tata Power Company · Mumbai Distribution', 'Private urban discom', 'Tata Power’s licensed areas in Mumbai.'),
  ],
  Manipur: [utility('mspdcl', 'Manipur State Power Distribution Company Limited (MSPDCL)', 'State discom', 'Manipur distribution area.')],
  Meghalaya: [utility('mepdcl', 'Meghalaya Power Distribution Corporation Limited (MePDCL)', 'State discom', 'Meghalaya distribution area.')],
  Mizoram: [utility('mizoram-power', 'Power & Electricity Department, Government of Mizoram', 'State department', 'Mizoram distribution area.')],
  Nagaland: [utility('nagaland-power', 'Electricity Department, Government of Nagaland', 'State department', 'Nagaland distribution area.')],
  Odisha: [
    utility('tpcodl', 'TP Central Odisha Distribution Limited (TPCODL)', 'State / private joint-venture discom', 'Central Odisha service area.'),
    utility('tpnodl', 'TP Northern Odisha Distribution Limited (TPNODL)', 'State / private joint-venture discom', 'Northern Odisha service area.'),
    utility('tpsodl', 'TP Southern Odisha Distribution Limited (TPSODL)', 'State / private joint-venture discom', 'Southern Odisha service area.'),
    utility('tpwodl', 'TP Western Odisha Distribution Limited (TPWODL)', 'State / private joint-venture discom', 'Western Odisha service area.'),
  ],
  Puducherry: [utility('puducherry-ed', 'Electricity Department, Government of Puducherry', 'UT department', 'Puducherry and its electricity-department regions.')],
  Punjab: [utility('pspcl', 'Punjab State Power Corporation Limited (PSPCL)', 'State utility', 'Punjab distribution area.')],
  Rajasthan: [
    utility('avvnl', 'Ajmer Vidyut Vitran Nigam Limited (AVVNL)', 'State discom', 'Ajmer discom service area.'),
    utility('jvvnl', 'Jaipur Vidyut Vitran Nigam Limited (JVVNL)', 'State discom', 'Jaipur discom service area.'),
    utility('jdvvnl', 'Jodhpur Vidyut Vitran Nigam Limited (JDVVNL)', 'State discom', 'Jodhpur discom service area.'),
  ],
  Sikkim: [utility('sikkim-power', 'Energy & Power Department, Government of Sikkim', 'State department', 'Sikkim distribution area.')],
  'Tamil Nadu': [utility('tnpdcl', 'Tamil Nadu Power Distribution Corporation Limited (TNPDCL, formerly TANGEDCO)', 'State discom', 'Tamil Nadu distribution area.')],
  Telangana: [
    utility('tsnpdcl', 'Northern Power Distribution Company of Telangana Limited (TGNPDCL / TSNPDCL)', 'State discom', 'Northern Telangana service area.'),
    utility('tsspdcl', 'Southern Power Distribution Company of Telangana Limited (TGSPDCL / TSSPDCL)', 'State discom', 'Southern Telangana service area.'),
  ],
  Tripura: [utility('tsecl', 'Tripura State Electricity Corporation Limited (TSECL)', 'State utility', 'Tripura distribution area.')],
  'Uttar Pradesh': [
    utility('dvvnl', 'Dakshinanchal Vidyut Vitran Nigam Limited (DVVNL)', 'State discom', 'South-west Uttar Pradesh / Agra discom area.'),
    utility('mvvnl', 'Madhyanchal Vidyut Vitran Nigam Limited (MVVNL)', 'State discom', 'Central Uttar Pradesh / Lucknow discom area.'),
    utility('pvvnl', 'Pashchimanchal Vidyut Vitran Nigam Limited (PVVNL)', 'State discom', 'Western Uttar Pradesh discom area.'),
    utility('puvvnl', 'Purvanchal Vidyut Vitran Nigam Limited (PuVVNL)', 'State discom', 'Eastern Uttar Pradesh / Varanasi discom area.'),
    utility('kesco', 'Kanpur Electricity Supply Company Limited (KESCO)', 'State urban discom', 'Kanpur city service area.'),
    utility('npcl', 'Noida Power Company Limited (NPCL)', 'Private urban discom', 'Noida and Greater Noida licensed area.'),
    utility('torrent-agra', 'Torrent Power · Agra', 'Private urban discom', 'Torrent Power licensed area in Agra.'),
  ],
  Uttarakhand: [utility('upcl', 'Uttarakhand Power Corporation Limited (UPCL)', 'State discom', 'Uttarakhand distribution area.')],
  'West Bengal': [
    utility('wbsedcl', 'West Bengal State Electricity Distribution Company Limited (WBSEDCL)', 'State discom', 'Most of West Bengal outside separately licensed urban, industrial and DVC areas.'),
    utility('cesc', 'CESC Limited', 'Private urban discom', 'CESC licensed areas in Kolkata, Howrah and adjacent urban pockets; verify against your bill.'),
    utility('dvc-west-bengal', 'Damodar Valley Corporation (DVC)', 'Central statutory utility', 'DVC command-area consumers, including industrial and bulk consumers in parts of West Bengal.'),
    utility('ipcl', 'India Power Corporation Limited (IPCL, formerly DPSC)', 'Private regional discom', 'Asansol–Raniganj and other specified licensed areas in Paschim Bardhaman.'),
  ],
  'Andaman and Nicobar Islands': [utility('andaman-electricity', 'Electricity Department, Andaman & Nicobar Administration', 'UT department', 'Island-specific electricity department service areas.')],
  Lakshadweep: [utility('lakshadweep-electricity', 'Electricity Department, Lakshadweep Administration', 'UT department', 'Island-specific electricity department service areas.')],
};

export const ELECTRICITY_DIRECTORY_SOURCES = [
  { label: 'Delhi Transco · States and UTs utility directory', url: 'https://www.dtl.gov.in/content/202_6_stateutgencotranscodiscom.aspx' },
  { label: 'West Bengal Electricity Regulatory Commission · distribution licensees', url: 'https://wberc.gov.in/sites/default/files/WBERC_489.pdf' },
  { label: 'Jharkhand State Electricity Regulatory Commission · distribution licensees', url: 'https://www.jserc.org/licensing.aspx' },
  { label: 'Maharashtra Electricity Regulatory Commission · distribution', url: 'https://new.merc.gov.in/electric/distribution/' },
  { label: 'Jammu Power Distribution Corporation · official site', url: 'https://jpdcl.jk.gov.in/' },
  { label: 'Kashmir Power Distribution Corporation · official site', url: 'https://kpdcl.jk.gov.in/' },
  { label: 'Tamil Nadu Power Distribution Corporation · profile', url: 'https://www.tnpdcl.org/en/tnpdcl/about-us/tnpdcl-profile/' },
];
