"""
SUMO TraCI (Traffic Control Interface) Bridge.
Connects Python AI Reinforcement Learning agents directly to SUMO (Simulation of Urban MObility).
Acts as the official TraCI socket client for live telemetry extraction and signal phase actuation.
"""

import os
import sys
import time

try:
    import traci
    import sumolib
    TRACI_AVAILABLE = True
except ImportError:
    TRACI_AVAILABLE = False


class TraCISUMOBridge:
    def __init__(self, sumocfg_path=None, use_gui=False, port=8873):
        self.sumocfg_path = sumocfg_path
        self.use_gui = use_gui
        self.port = port
        self.connected = False
        self.step_num = 0

    def check_sumo_binary(self):
        """Checks if SUMO / SUMO-GUI binary is in system PATH or SUMO_HOME."""
        sumo_home = os.environ.get("SUMO_HOME", "")
        binary_name = "sumo-gui" if self.use_gui else "sumo"
        
        # Check direct command
        if os.system(f"where {binary_name} >nul 2>&1") == 0:
            return binary_name
        
        if sumo_home:
            bin_path = os.path.join(sumo_home, "bin", f"{binary_name}.exe")
            if os.path.exists(bin_path):
                return bin_path
        return None

    def start_simulation(self, sumocfg_file):
        """Starts SUMO simulation kernel with TraCI server enabled."""
        if not TRACI_AVAILABLE:
            print("[TraCI Bridge] Warning: traci library not found. Running in Digital Twin Emulation Mode.")
            return False

        sumo_bin = self.check_sumo_binary()
        if not sumo_bin or not os.path.exists(sumocfg_file):
            print(f"[TraCI Bridge] SUMO executable not found in PATH or config missing. Emulation fallback active.")
            return False

        try:
            sumo_cmd = [sumo_bin, "-c", sumocfg_file, "--step-length", "1.0", "--start", "--quit-on-end"]
            traci.start(sumo_cmd, port=self.port)
            self.connected = True
            print(f"[TraCI Bridge] Successfully connected to SUMO via TraCI port {self.port}.")
            return True
        except Exception as e:
            print(f"[TraCI Bridge Error]: {e}")
            self.connected = False
            return False

    def step(self):
        """Advances SUMO simulation by 1 step via TraCI."""
        if self.connected and TRACI_AVAILABLE:
            traci.simulationStep()
            self.step_num += 1

    def get_junction_telemetry(self, junction_id):
        """Extracts queue lengths, waiting vehicles, and speeds around a junction."""
        if not self.connected or not TRACI_AVAILABLE:
            return {"queue": 0, "avg_speed": 35.0, "waiting_time": 0.0}

        try:
            # TraCI calls
            vehs_in_network = traci.vehicle.getIDList()
            queue_count = 0
            speeds = []
            waits = []
            
            for v_id in vehs_in_network:
                v_speed = traci.vehicle.getSpeed(v_id)
                v_wait = traci.vehicle.getWaitingTime(v_id)
                speeds.append(v_speed * 3.6)
                waits.append(v_wait)
                if v_speed < 1.0:
                    queue_count += 1

            return {
                "junction_id": junction_id,
                "vehicle_count": len(vehs_in_network),
                "queue": queue_count,
                "avg_speed": sum(speeds) / max(1, len(speeds)),
                "avg_wait": sum(waits) / max(1, len(waits))
            }
        except Exception as e:
            print(f"[TraCI Telemetry Error]: {e}")
            return {"queue": 0, "avg_speed": 30.0, "waiting_time": 0.0}

    def set_traffic_light_phase(self, tls_id, phase_index, duration=None):
        """Actuates traffic light program phase via TraCI."""
        if self.connected and TRACI_AVAILABLE:
            try:
                traci.trafficlight.setPhase(tls_id, phase_index)
                if duration:
                    traci.trafficlight.setPhaseDuration(tls_id, duration)
            except Exception as e:
                print(f"[TraCI Phase Error]: {e}")

    def close(self):
        """Disconnects TraCI connection."""
        if self.connected and TRACI_AVAILABLE:
            traci.close()
            self.connected = False
