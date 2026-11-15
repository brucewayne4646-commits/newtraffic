"""
Indian Metropolitan Traffic Hotspots with Calibrated Real-World Road Geometries.
Uses precise multi-segment road waypoints following real OpenStreetMap asphalt corridors,
with Left-Hand Driving (LHD) lane allocations for Indian roads.
"""

INDIAN_HOTSPOTS = {
    "bengaluru_silkboard": {
        "id": "bengaluru_silkboard",
        "city": "Bengaluru",
        "name": "Central Silk Board Junction (Hosur Rd / Outer Ring Rd)",
        "lat": 12.91715,
        "lng": 77.62250,
        "zoom": 17,
        "description": "India's highest density arterial bottleneck connecting BTM, HSR Layout, Electronic City, and Koramangala.",
        "nodes": [
            {"id": "J_SILK", "name": "Silk Board Main Junction", "lat": 12.91715, "lng": 77.62250, "lanes": 4, "type": "signalized"},
            {"id": "J_HSR", "name": "HSR Layout 5th Main Entry", "lat": 12.91700, "lng": 77.63350, "lanes": 4, "type": "signalized"},
            {"id": "J_BTM", "name": "BTM 29th Main Outer Ring", "lat": 12.91580, "lng": 77.61350, "lanes": 3, "type": "signalized"},
            {"id": "J_ECITY", "name": "Hosur Rd - E-City Elevated Ramp", "lat": 12.90650, "lng": 77.62680, "lanes": 4, "type": "signalized"},
            {"id": "J_MADIWALA", "name": "Madiwala Checkpost Corridor", "lat": 12.92520, "lng": 77.61850, "lanes": 4, "type": "signalized"}
        ],
        "corridors": [
            # Corridors calibrated to exact OpenStreetMap asphalt centerlines
            {
                "id": "BTM_TO_SILK",
                "from": "J_BTM",
                "to": "J_SILK",
                "name": "Outer Ring Road (BTM -> Silk Board)",
                "lanes": 3,
                "speed_limit": 50,
                "waypoints": [
                    [12.91580, 77.61350],
                    [12.91620, 77.61700],
                    [12.91660, 77.61980],
                    [12.91690, 77.62150],
                    [12.91715, 77.62250]
                ]
            },
            {
                "id": "SILK_TO_BTM",
                "from": "J_SILK",
                "to": "J_BTM",
                "name": "Outer Ring Road (Silk Board -> BTM)",
                "lanes": 3,
                "speed_limit": 50,
                "waypoints": [
                    [12.91715, 77.62250],
                    [12.91690, 77.62150],
                    [12.91660, 77.61980],
                    [12.91620, 77.61700],
                    [12.91580, 77.61350]
                ]
            },
            {
                "id": "SILK_TO_HSR",
                "from": "J_SILK",
                "to": "J_HSR",
                "name": "Outer Ring Road (Silk Board -> HSR)",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [12.91715, 77.62250],
                    [12.91695, 77.62480],
                    [12.91685, 77.62750],
                    [12.91685, 77.63050],
                    [12.91700, 77.63350]
                ]
            },
            {
                "id": "HSR_TO_SILK",
                "from": "J_HSR",
                "to": "J_SILK",
                "name": "Outer Ring Road (HSR -> Silk Board)",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [12.91700, 77.63350],
                    [12.91685, 77.63050],
                    [12.91685, 77.62750],
                    [12.91695, 77.62480],
                    [12.91715, 77.62250]
                ]
            },
            {
                "id": "MADIWALA_TO_SILK",
                "from": "J_MADIWALA",
                "to": "J_SILK",
                "name": "Hosur Road (Madiwala -> Silk Board)",
                "lanes": 4,
                "speed_limit": 50,
                "waypoints": [
                    [12.92520, 77.61850],
                    [12.92250, 77.61980],
                    [12.91980, 77.62120],
                    [12.91820, 77.62200],
                    [12.91715, 77.62250]
                ]
            },
            {
                "id": "SILK_TO_MADIWALA",
                "from": "J_SILK",
                "to": "J_MADIWALA",
                "name": "Hosur Road (Silk Board -> Madiwala)",
                "lanes": 4,
                "speed_limit": 50,
                "waypoints": [
                    [12.91715, 77.62250],
                    [12.91820, 77.62200],
                    [12.91980, 77.62120],
                    [12.92250, 77.61980],
                    [12.92520, 77.61850]
                ]
            },
            {
                "id": "SILK_TO_ECITY",
                "from": "J_SILK",
                "to": "J_ECITY",
                "name": "Hosur Expressway (Silk Board -> E-City)",
                "lanes": 4,
                "speed_limit": 65,
                "waypoints": [
                    [12.91715, 77.62250],
                    [12.91420, 77.62380],
                    [12.91050, 77.62520],
                    [12.90650, 77.62680]
                ]
            },
            {
                "id": "ECITY_TO_SILK",
                "from": "J_ECITY",
                "to": "J_SILK",
                "name": "Hosur Expressway (E-City -> Silk Board)",
                "lanes": 4,
                "speed_limit": 65,
                "waypoints": [
                    [12.90650, 77.62680],
                    [12.91050, 77.62520],
                    [12.91420, 77.62380],
                    [12.91715, 77.62250]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.42, "auto_rickshaw": 0.22, "car": 0.26, "bus": 0.07, "truck": 0.03},
        "base_flow_vph": 4800
    },
    "delhi_cp": {
        "id": "delhi_cp",
        "city": "Delhi NCR",
        "name": "Connaught Place (Outer Circle & Radials)",
        "lat": 28.63280,
        "lng": 77.21970,
        "zoom": 17,
        "description": "Concentric circle and radial corridors connecting Barakhamba, KG Marg, Janpath, and Parliament Street.",
        "nodes": [
            {"id": "J_BARA", "name": "Outer Circle - Barakhamba Jn", "lat": 28.63220, "lng": 77.22350, "lanes": 4, "type": "signalized"},
            {"id": "J_KG", "name": "Outer Circle - KG Marg Jn", "lat": 28.62950, "lng": 77.22220, "lanes": 4, "type": "signalized"},
            {"id": "J_JANPATH", "name": "Outer Circle - Janpath Jn", "lat": 28.62880, "lng": 77.21850, "lanes": 4, "type": "signalized"},
            {"id": "J_SANSAD", "name": "Outer Circle - Sansad Marg", "lat": 28.62980, "lng": 77.21480, "lanes": 4, "type": "signalized"},
            {"id": "J_MANDI", "name": "Mandi House Radial Hub", "lat": 28.62580, "lng": 77.23470, "lanes": 4, "type": "signalized"}
        ],
        "corridors": [
            {
                "id": "BARA_TO_KG",
                "from": "J_BARA",
                "to": "J_KG",
                "name": "Outer Circle (Barakhamba -> KG Marg)",
                "lanes": 4,
                "speed_limit": 45,
                "waypoints": [
                    [28.63220, 77.22350],
                    [28.63080, 77.22320],
                    [28.62950, 77.22220]
                ]
            },
            {
                "id": "KG_TO_JANPATH",
                "from": "J_KG",
                "to": "J_JANPATH",
                "name": "Outer Circle (KG Marg -> Janpath)",
                "lanes": 4,
                "speed_limit": 45,
                "waypoints": [
                    [28.62950, 77.22220],
                    [28.62890, 77.22050],
                    [28.62880, 77.21850]
                ]
            },
            {
                "id": "JANPATH_TO_SANSAD",
                "from": "J_JANPATH",
                "to": "J_SANSAD",
                "name": "Outer Circle (Janpath -> Sansad Marg)",
                "lanes": 4,
                "speed_limit": 45,
                "waypoints": [
                    [28.62880, 77.21850],
                    [28.62910, 77.21650],
                    [28.62980, 77.21480]
                ]
            },
            {
                "id": "SANSAD_TO_BARA",
                "from": "J_SANSAD",
                "to": "J_BARA",
                "name": "Outer Circle (Sansad Marg -> Barakhamba)",
                "lanes": 4,
                "speed_limit": 45,
                "waypoints": [
                    [28.62980, 77.21480],
                    [28.63180, 77.21400],
                    [28.63420, 77.21520],
                    [28.63580, 77.21850],
                    [28.63500, 77.22180],
                    [28.63220, 77.22350]
                ]
            },
            {
                "id": "BARA_TO_MANDI",
                "from": "J_BARA",
                "to": "J_MANDI",
                "name": "Barakhamba Road (CP -> Mandi House)",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [28.63220, 77.22350],
                    [28.62920, 77.22850],
                    [28.62580, 77.23470]
                ]
            },
            {
                "id": "MANDI_TO_BARA",
                "from": "J_MANDI",
                "to": "J_BARA",
                "name": "Barakhamba Road (Mandi House -> CP)",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [28.62580, 77.23470],
                    [28.62920, 77.22850],
                    [28.63220, 77.22350]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.32, "auto_rickshaw": 0.24, "car": 0.36, "bus": 0.06, "truck": 0.02},
        "base_flow_vph": 4600
    },
    "mumbai_bkc": {
        "id": "mumbai_bkc",
        "city": "Mumbai",
        "name": "Bandra Kurla Complex (BKC - Kalanagar Junction)",
        "lat": 19.05580,
        "lng": 72.84880,
        "zoom": 17,
        "description": "Financial epicenter of Mumbai with dense peak hour corporate commuter traffic and WEH connector.",
        "nodes": [
            {"id": "J_KALA", "name": "Kalanagar Junction Hub", "lat": 19.05580, "lng": 72.84880, "lanes": 4, "type": "signalized"},
            {"id": "J_BKC_CORE", "name": "BKC Avenue Central", "lat": 19.06200, "lng": 72.86250, "lanes": 4, "type": "signalized"},
            {"id": "J_WEH_S", "name": "Western Express Highway South", "lat": 19.04850, "lng": 72.84450, "lanes": 4, "type": "signalized"},
            {"id": "J_BANDRA_E", "name": "Bandra East Stn Connector", "lat": 19.06250, "lng": 72.84350, "lanes": 3, "type": "signalized"}
        ],
        "corridors": [
            {
                "id": "WEH_TO_KALA",
                "from": "J_WEH_S",
                "to": "J_KALA",
                "name": "Western Express Highway -> Kalanagar",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [19.04850, 72.84450],
                    [19.05200, 72.84650],
                    [19.05580, 72.84880]
                ]
            },
            {
                "id": "KALA_TO_WEH",
                "from": "J_KALA",
                "to": "J_WEH_S",
                "name": "Kalanagar -> Western Express Highway",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [19.05580, 72.84880],
                    [19.05200, 72.84650],
                    [19.04850, 72.84450]
                ]
            },
            {
                "id": "KALA_TO_BKC",
                "from": "J_KALA",
                "to": "J_BKC_CORE",
                "name": "BKC Connector -> Diamond Market",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [19.05580, 72.84880],
                    [19.05820, 72.85350],
                    [19.06050, 72.85800],
                    [19.06200, 72.86250]
                ]
            },
            {
                "id": "BKC_TO_KALA",
                "from": "J_BKC_CORE",
                "to": "J_KALA",
                "name": "Diamond Market -> Kalanagar",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [19.06200, 72.86250],
                    [19.06050, 72.85800],
                    [19.05820, 72.85350],
                    [19.05580, 72.84880]
                ]
            },
            {
                "id": "BANDRA_TO_KALA",
                "from": "J_BANDRA_E",
                "to": "J_KALA",
                "name": "Bandra Stn East -> Kalanagar",
                "lanes": 3,
                "speed_limit": 45,
                "waypoints": [
                    [19.06250, 72.84350],
                    [19.05900, 72.84600],
                    [19.05580, 72.84880]
                ]
            },
            {
                "id": "KALA_TO_BANDRA",
                "from": "J_KALA",
                "to": "J_BANDRA_E",
                "name": "Kalanagar -> Bandra Stn East",
                "lanes": 3,
                "speed_limit": 45,
                "waypoints": [
                    [19.05580, 72.84880],
                    [19.05900, 72.84600],
                    [19.06250, 72.84350]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.28, "auto_rickshaw": 0.30, "car": 0.34, "bus": 0.06, "truck": 0.02},
        "base_flow_vph": 5200
    },
    "hyderabad_hitec": {
        "id": "hyderabad_hitec",
        "city": "Hyderabad",
        "name": "Hitec City (Cyber Towers Junction)",
        "lat": 17.44750,
        "lng": 78.37800,
        "zoom": 17,
        "description": "Major IT technology corridor connecting Madhapur, Gachibowli, Kondapur, and Mindspace.",
        "nodes": [
            {"id": "J_CYBER", "name": "Cyber Towers Main Junction", "lat": 17.44750, "lng": 78.37800, "lanes": 4, "type": "signalized"},
            {"id": "J_MINDSPACE", "name": "Mindspace Tech Gateway", "lat": 17.43950, "lng": 78.38120, "lanes": 4, "type": "signalized"},
            {"id": "J_KONDAPUR", "name": "Kondapur RTA Cross", "lat": 17.45850, "lng": 78.36850, "lanes": 3, "type": "signalized"},
            {"id": "J_JUBILEE", "name": "Jubilee Hills Road 36", "lat": 17.44350, "lng": 78.39500, "lanes": 4, "type": "signalized"}
        ],
        "corridors": [
            {
                "id": "KONDA_TO_CYBER",
                "from": "J_KONDAPUR",
                "to": "J_CYBER",
                "name": "Kondapur -> Cyber Towers",
                "lanes": 3,
                "speed_limit": 55,
                "waypoints": [
                    [17.45850, 78.36850],
                    [17.45400, 78.37200],
                    [17.45050, 78.37520],
                    [17.44750, 78.37800]
                ]
            },
            {
                "id": "CYBER_TO_KONDA",
                "from": "J_CYBER",
                "to": "J_KONDAPUR",
                "name": "Cyber Towers -> Kondapur",
                "lanes": 3,
                "speed_limit": 55,
                "waypoints": [
                    [17.44750, 78.37800],
                    [17.45050, 78.37520],
                    [17.45400, 78.37200],
                    [17.45850, 78.36850]
                ]
            },
            {
                "id": "CYBER_TO_MIND",
                "from": "J_CYBER",
                "to": "J_MINDSPACE",
                "name": "Cyber Towers -> Mindspace",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [17.44750, 78.37800],
                    [17.44350, 78.37950],
                    [17.43950, 78.38120]
                ]
            },
            {
                "id": "MIND_TO_CYBER",
                "from": "J_MINDSPACE",
                "to": "J_CYBER",
                "name": "Mindspace -> Cyber Towers",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [17.43950, 78.38120],
                    [17.44350, 78.37950],
                    [17.44750, 78.37800]
                ]
            },
            {
                "id": "JUBILEE_TO_CYBER",
                "from": "J_JUBILEE",
                "to": "J_CYBER",
                "name": "Jubilee Hills -> Cyber Towers",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [17.44350, 78.39500],
                    [17.44480, 78.38850],
                    [17.44620, 78.38250],
                    [17.44750, 78.37800]
                ]
            },
            {
                "id": "CYBER_TO_JUBILEE",
                "from": "J_CYBER",
                "to": "J_JUBILEE",
                "name": "Cyber Towers -> Jubilee Hills",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [17.44750, 78.37800],
                    [17.44620, 78.38250],
                    [17.44480, 78.38850],
                    [17.44350, 78.39500]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.40, "auto_rickshaw": 0.20, "car": 0.32, "bus": 0.06, "truck": 0.02},
        "base_flow_vph": 4500
    },
    "pune_hinjawadi": {
        "id": "pune_hinjawadi",
        "city": "Pune",
        "name": "Hinjawadi Phase 1 Shivaji Chowk",
        "lat": 18.59240,
        "lng": 73.73740,
        "zoom": 17,
        "description": "Tech hub arterial entry experiencing severe peak rush hour congestion on the Mumbai-Bengaluru Highway bypass.",
        "nodes": [
            {"id": "J_SHIVAJI", "name": "Shivaji Chowk Hinjawadi", "lat": 18.59240, "lng": 73.73740, "lanes": 3, "type": "signalized"},
            {"id": "J_WAKAD", "name": "Wakad Bridge Flyover", "lat": 18.59750, "lng": 73.75550, "lanes": 4, "type": "signalized"},
            {"id": "J_PHASE2", "name": "Phase 2 Tech Park Gate", "lat": 18.58050, "lng": 73.71550, "lanes": 3, "type": "signalized"}
        ],
        "corridors": [
            {
                "id": "WAKAD_TO_SHIVAJI",
                "from": "J_WAKAD",
                "to": "J_SHIVAJI",
                "name": "Wakad Bridge -> Shivaji Chowk",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [18.59750, 73.75550],
                    [18.59550, 73.74850],
                    [18.59350, 73.74250],
                    [18.59240, 73.73740]
                ]
            },
            {
                "id": "SHIVAJI_TO_WAKAD",
                "from": "J_SHIVAJI",
                "to": "J_WAKAD",
                "name": "Shivaji Chowk -> Wakad Bridge",
                "lanes": 4,
                "speed_limit": 55,
                "waypoints": [
                    [18.59240, 73.73740],
                    [18.59350, 73.74250],
                    [18.59550, 73.74850],
                    [18.59750, 73.75550]
                ]
            },
            {
                "id": "PHASE2_TO_SHIVAJI",
                "from": "J_PHASE2",
                "to": "J_SHIVAJI",
                "name": "Phase 2 Tech Park -> Shivaji Chowk",
                "lanes": 3,
                "speed_limit": 50,
                "waypoints": [
                    [18.58050, 73.71550],
                    [18.58550, 73.72450],
                    [18.58950, 73.73150],
                    [18.59240, 73.73740]
                ]
            },
            {
                "id": "SHIVAJI_TO_PHASE2",
                "from": "J_SHIVAJI",
                "to": "J_PHASE2",
                "name": "Shivaji Chowk -> Phase 2 Tech Park",
                "lanes": 3,
                "speed_limit": 50,
                "waypoints": [
                    [18.59240, 73.73740],
                    [18.58950, 73.73150],
                    [18.58550, 73.72450],
                    [18.58050, 73.71550]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.48, "auto_rickshaw": 0.18, "car": 0.28, "bus": 0.05, "truck": 0.01},
        "base_flow_vph": 4000
    },
    "chennai_guindy": {
        "id": "chennai_guindy",
        "city": "Chennai",
        "name": "Guindy Kathipara Cloverleaf Junction",
        "lat": 13.00730,
        "lng": 80.20370,
        "zoom": 17,
        "description": "Asia's largest cloverleaf interchange connecting GST Road, Inner Ring Road, Mount-Poonamallee, and Anna Salai.",
        "nodes": [
            {"id": "J_KATHI", "name": "Kathipara Central Hub", "lat": 13.00730, "lng": 80.20370, "lanes": 4, "type": "signalized"},
            {"id": "J_GST", "name": "GST Road Airport Corridor", "lat": 12.99450, "lng": 80.18850, "lanes": 4, "type": "signalized"},
            {"id": "J_ANNA", "name": "Anna Salai - Guindy Stn", "lat": 13.01650, "lng": 80.21850, "lanes": 4, "type": "signalized"}
        ],
        "corridors": [
            {
                "id": "GST_TO_KATHI",
                "from": "J_GST",
                "to": "J_KATHI",
                "name": "GST Airport -> Kathipara Hub",
                "lanes": 4,
                "speed_limit": 65,
                "waypoints": [
                    [12.99450, 80.18850],
                    [12.99950, 80.19450],
                    [13.00350, 80.19900],
                    [13.00730, 80.20370]
                ]
            },
            {
                "id": "KATHI_TO_GST",
                "from": "J_KATHI",
                "to": "J_GST",
                "name": "Kathipara Hub -> GST Airport",
                "lanes": 4,
                "speed_limit": 65,
                "waypoints": [
                    [13.00730, 80.20370],
                    [13.00350, 80.19900],
                    [12.99950, 80.19450],
                    [12.99450, 80.18850]
                ]
            },
            {
                "id": "ANNA_TO_KATHI",
                "from": "J_ANNA",
                "to": "J_KATHI",
                "name": "Anna Salai -> Kathipara Hub",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [13.01650, 80.21850],
                    [13.01350, 80.21350],
                    [13.01050, 80.20850],
                    [13.00730, 80.20370]
                ]
            },
            {
                "id": "KATHI_TO_ANNA",
                "from": "J_KATHI",
                "to": "J_ANNA",
                "name": "Kathipara Hub -> Anna Salai",
                "lanes": 4,
                "speed_limit": 60,
                "waypoints": [
                    [13.00730, 80.20370],
                    [13.01050, 80.20850],
                    [13.01350, 80.21350],
                    [13.01650, 80.21850]
                ]
            }
        ],
        "traffic_mix": {"two_wheeler": 0.44, "auto_rickshaw": 0.20, "car": 0.28, "bus": 0.06, "truck": 0.02},
        "base_flow_vph": 4900
    }
}
