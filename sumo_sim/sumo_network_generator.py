"""
SUMO (Simulation of Urban MObility) Network & Route Generator.
Programmatically builds SUMO XML network (.nod.xml, .edg.xml, .net.xml), 
traffic routes (.rou.xml), and configuration (.sumocfg) for Indian urban intersections.
"""

import os
import sys
import xml.etree.ElementTree as ET

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from core.indian_locations import INDIAN_HOTSPOTS


class SUMONetworkBuilder:
    def __init__(self, output_dir="sumo_sim/networks"):
        self.output_dir = output_dir
        os.makedirs(self.output_dir, exist_ok=True)

    def generate_sumo_files(self, hotspot_id="bengaluru_silkboard"):
        """Generates SUMO configuration and route files for an Indian hotspot."""
        hotspot = INDIAN_HOTSPOTS.get(hotspot_id, INDIAN_HOTSPOTS["bengaluru_silkboard"])
        prefix = os.path.join(self.output_dir, hotspot_id)

        # 1. Generate .nod.xml (Nodes)
        nod_path = f"{prefix}.nod.xml"
        nodes_root = ET.Element("nodes")
        for node in hotspot["nodes"]:
            # Convert lat/lng to local cartesian offset (meters)
            ref_lat, ref_lng = hotspot["lat"], hotspot["lng"]
            x = (node["lng"] - ref_lng) * 111320.0 * 0.9  # approx meters
            y = (node["lat"] - ref_lat) * 110540.0
            ET.SubElement(nodes_root, "node", {
                "id": node["id"],
                "x": f"{x:.2f}",
                "y": f"{y:.2f}",
                "type": "traffic_light" if node.get("type") == "signalized" else "priority"
            })
        ET.ElementTree(nodes_root).write(nod_path, encoding="utf-8", xml_declaration=True)

        # 2. Generate .edg.xml (Edges)
        edg_path = f"{prefix}.edg.xml"
        edges_root = ET.Element("edges")
        for edge in hotspot["edges"]:
            ET.SubElement(edges_root, "edge", {
                "id": f"{edge['from']}_to_{edge['to']}",
                "from": edge["from"],
                "to": edge["to"],
                "numLanes": str(edge["lanes"]),
                "speed": f"{edge['speed_limit'] / 3.6:.2f}",
                "priority": "2"
            })
        ET.ElementTree(edges_root).write(edg_path, encoding="utf-8", xml_declaration=True)

        # 3. Generate .rou.xml (Routes & Indian Vehicle Types)
        rou_path = f"{prefix}.rou.xml"
        routes_root = ET.Element("routes")
        
        # Vehicle Type Definitions with Indian PCU and physical dynamics
        vtypes = [
            {"id": "two_wheeler", "accel": "3.2", "decel": "4.5", "length": "2.0", "maxSpeed": "16.6", "color": "0,240,255"},
            {"id": "auto_rickshaw", "accel": "2.2", "decel": "3.8", "length": "2.7", "maxSpeed": "13.3", "color": "255,215,0"},
            {"id": "car", "accel": "2.6", "decel": "4.0", "length": "4.2", "maxSpeed": "18.0", "color": "56,239,125"},
            {"id": "bus", "accel": "1.2", "decel": "2.5", "length": "11.0", "maxSpeed": "12.5", "color": "255,140,0"},
            {"id": "truck", "accel": "1.0", "decel": "2.2", "length": "9.5", "maxSpeed": "11.1", "color": "179,136,255"},
            {"id": "ambulance", "accel": "3.5", "decel": "4.5", "length": "5.2", "maxSpeed": "22.0", "color": "255,0,85", "guiShape": "emergency"}
        ]
        for vt in vtypes:
            ET.SubElement(routes_root, "vType", vt)

        # Define Flows
        for i, edge in enumerate(hotspot["edges"]):
            ET.SubElement(routes_root, "flow", {
                "id": f"flow_{i}",
                "type": "car",
                "begin": "0",
                "end": "3600",
                "vehsPerHour": str(int(hotspot.get("base_flow_vph", 3600) / len(hotspot["edges"]))),
                "from": f"{edge['from']}_to_{edge['to']}"
            })
        ET.ElementTree(routes_root).write(rou_path, encoding="utf-8", xml_declaration=True)

        # 4. Generate .sumocfg (Main SUMO configuration)
        cfg_path = f"{prefix}.sumocfg"
        cfg_root = ET.Element("configuration")
        input_el = ET.SubElement(cfg_root, "input")
        ET.SubElement(input_el, "net-file", {"value": f"{hotspot_id}.net.xml"})
        ET.SubElement(input_el, "route-files", {"value": f"{hotspot_id}.rou.xml"})
        time_el = ET.SubElement(cfg_root, "time")
        ET.SubElement(time_el, "begin", {"value": "0"})
        ET.SubElement(time_el, "end", {"value": "3600"})
        ET.SubElement(time_el, "step-length", {"value": "1.0"})
        ET.ElementTree(cfg_root).write(cfg_path, encoding="utf-8", xml_declaration=True)

        return {
            "hotspot_id": hotspot_id,
            "nod_file": nod_path,
            "edg_file": edg_path,
            "rou_file": rou_path,
            "cfg_file": cfg_path
        }


if __name__ == "__main__":
    builder = SUMONetworkBuilder()
    for hid in INDIAN_HOTSPOTS:
        res = builder.generate_sumo_files(hid)
        print(f"Generated SUMO configuration for {hid}: {res['cfg_file']}")
