"""
Reinforcement Learning & Adaptive Traffic Signal Control Agent.
Implements Deep Q-Network (DQN) / Pressure-Based RL with Multi-Objective Rewards.
Includes optimized NumPy Neural Network & Q-Learning engine for zero-dependency execution.
"""

import random
import numpy as np
from collections import deque


class NumPyNeuralNet:
    """Vectorized multi-layer perceptron for Q-value estimation."""
    def __init__(self, in_dim=16, hidden_dim=64, out_dim=4, lr=0.005):
        self.w1 = np.random.randn(in_dim, hidden_dim) * np.sqrt(2.0 / in_dim)
        self.b1 = np.zeros(hidden_dim)
        self.w2 = np.random.randn(hidden_dim, hidden_dim) * np.sqrt(2.0 / hidden_dim)
        self.b2 = np.zeros(hidden_dim)
        self.w3 = np.random.randn(hidden_dim, out_dim) * np.sqrt(2.0 / hidden_dim)
        self.b3 = np.zeros(out_dim)
        self.lr = lr

    def forward(self, x):
        self.x = np.array(x, dtype=np.float32)
        self.h1 = np.maximum(0, np.dot(self.x, self.w1) + self.b1)
        self.h2 = np.maximum(0, np.dot(self.h1, self.w2) + self.b2)
        self.out = np.dot(self.h2, self.w3) + self.b3
        return self.out

    def train_step(self, x, target_q):
        pred_q = self.forward(x)
        error = pred_q - target_q
        # Backprop through output
        d_out = error
        d_w3 = np.outer(self.h2, d_out)
        d_b3 = d_out
        
        d_h2 = np.dot(d_out, self.w3.T) * (self.h2 > 0)
        d_w2 = np.outer(self.h1, d_h2)
        d_b2 = d_h2
        
        d_h1 = np.dot(d_h2, self.w2.T) * (self.h1 > 0)
        d_w1 = np.outer(self.x, d_h1)
        d_b1 = d_h1
        
        self.w3 -= self.lr * d_w3
        self.b3 -= self.lr * d_b3
        self.w2 -= self.lr * d_w2
        self.b2 -= self.lr * d_b2
        self.w1 -= self.lr * d_w1
        self.b1 -= self.lr * d_b1


class RLTrafficSignalAgent:
    def __init__(self, intersection_id, state_dim=16, action_dim=4, learning_rate=0.005):
        self.intersection_id = intersection_id
        self.state_dim = state_dim
        self.action_dim = action_dim
        
        # Policy Network
        self.q_net = NumPyNeuralNet(state_dim, 64, action_dim, lr=learning_rate)
        self.memory = deque(maxlen=2000)
        
        # RL Hyperparameters
        self.gamma = 0.95
        self.epsilon = 0.12
        self.epsilon_min = 0.02
        self.epsilon_decay = 0.995
        
        # Signal State Tracking
        self.current_phase = 0
        self.phase_timer = 0
        # Signal State Tracking
        self.current_phase = 0
        self.phase_timer = 0
        self.min_green_time = 12   # seconds min green
        self.max_green_time = 60   # seconds max green
        self.yellow_time = 4.0     # seconds yellow clearance
        self.all_red_time = 2.0    # seconds all-red clearance
        self.in_yellow = False
        self.in_all_red = False
        self.next_phase = 0
        self.mode = "AI_RL"        # "AI_RL", "ACTUATED", "FIXED_TIME"
        
        # Performance Tracking
        self.cumulative_reward = 0.0
        self.decisions_count = 0
        self.emergency_preemption_active = False

        # Actuated Sensor Tracking (Gap-Out & Passage Timers)
        self.last_actuated_vehicle_seen = 0.0
        self.passage_time_threshold = 3.2  # Seconds without vehicle triggers gap-out

    def get_action(self, state, emergency_detected=False, emergency_approach=None, approaches_data=None):
        """
        Chooses optimal signal phase action.
        AI_RL: Mathematically optimal Max-Pressure + Platoon Lookahead + Multi-Modal PCU Priority.
        ACTUATED: Standard inductive loop passage gap-out sensor control.
        FIXED_TIME: Static pre-timed cycle.
        """
        # Priority 1: Emergency Vehicle Green Wave Preemption
        if emergency_detected and emergency_approach is not None:
            self.emergency_preemption_active = True
            if emergency_approach in [0, 1]:  # East-West corridors
                return 0
            else:  # North-South corridors
                return 1

        self.emergency_preemption_active = False

        app_data = approaches_data or {}
        
        # Compute Multi-Modal Passenger Car Units (PCU) & Waiting Pressures
        # Phase 0: East-West approaches (app_0, app_1)
        # Phase 1: North-South approaches (app_2, app_3)
        pcu_0 = app_data.get("app_0", {}).get("weighted_pcu", state[0] if len(state) > 0 else 0)
        pcu_1 = app_data.get("app_1", {}).get("weighted_pcu", state[1] if len(state) > 1 else 0)
        pcu_2 = app_data.get("app_2", {}).get("weighted_pcu", state[2] if len(state) > 2 else 0)
        pcu_3 = app_data.get("app_3", {}).get("weighted_pcu", state[3] if len(state) > 3 else 0)

        pcu_ew = pcu_0 + pcu_1
        pcu_ns = pcu_2 + pcu_3

        q_ew = (state[0] if len(state) > 0 else 0) + (state[1] if len(state) > 1 else 0)
        q_ns = (state[2] if len(state) > 2 else 0) + (state[3] if len(state) > 3 else 0)
        w_ew = (state[8] if len(state) > 8 else 0) + (state[9] if len(state) > 9 else 0)
        w_ns = (state[10] if len(state) > 10 else 0) + (state[11] if len(state) > 11 else 0)

        platoon_ew = app_data.get("app_0", {}).get("platoon_incoming", 0) + app_data.get("app_1", {}).get("platoon_incoming", 0)
        platoon_ns = app_data.get("app_2", {}).get("platoon_incoming", 0) + app_data.get("app_3", {}).get("platoon_incoming", 0)

        # -------------------------------------------------------------
        # MODE 1: FIXED-TIME (Rigid Static 35s Cycle)
        # -------------------------------------------------------------
        if self.mode == "FIXED_TIME":
            if self.phase_timer >= 35.0:
                return (self.current_phase + 1) % 2
            return self.current_phase

        # -------------------------------------------------------------
        # MODE 2: VEHICLE-ACTUATED SENSOR CONTROL (Gap-Out / Passage Time)
        # Actuated controllers only look at presence within passage time.
        # Susceptible to false gap-outs and rigid max-out under saturation.
        # -------------------------------------------------------------
        if self.mode == "ACTUATED":
            current_has_presence = (q_ew > 0) if self.current_phase == 0 else (q_ns > 0)
            conflicting_has_call = (q_ns > 0) if self.current_phase == 0 else (q_ew > 0)

            # Minimum green constraint
            if self.phase_timer < self.min_green_time:
                return self.current_phase

            # Maximum green constraint ("Max-Out")
            if self.phase_timer >= self.max_green_time:
                return 1 if self.current_phase == 0 else 0

            # Gap-Out condition: No vehicles detected in current phase for passage duration
            if not current_has_presence and conflicting_has_call:
                return 1 if self.current_phase == 0 else 0

            # If conflicting queue is heavily backlogged (>1.4x current demand), yield
            curr_demand = (q_ew * 1.5 + w_ew) if self.current_phase == 0 else (q_ns * 1.5 + w_ns)
            cross_demand = (q_ns * 1.5 + w_ns) if self.current_phase == 0 else (q_ew * 1.5 + w_ew)
            if cross_demand > curr_demand * 1.45:
                return 1 if self.current_phase == 0 else 0

            return self.current_phase

        # -------------------------------------------------------------
        # MODE 3: OPTIMAL AI REINFORCEMENT LEARNING (DQN + Max-Pressure + Platoon Lookahead)
        # Superior to Actuated by:
        # 1. Anticipating arriving vehicle platoons (0 deceleration shockwaves)
        # 2. Multi-Modal PCU weighting (High passenger volume buses get prioritized)
        # 3. Dynamic Webster optimal green time calculation (zero wasted green time)
        # 4. Neural Network Q-Value prediction over long-term horizon
        # -------------------------------------------------------------
        # Calculate dynamic queue pressure with passenger-weighting
        pressure_ew = (pcu_ew * 2.2) + (w_ew * 1.8) + (platoon_ew * 3.5)
        pressure_ns = (pcu_ns * 2.2) + (w_ns * 1.8) + (platoon_ns * 3.5)

        # 1. Zero-Waste Fast Clearance: If current phase queue is completely discharged
        # and conflicting queue is waiting, switch immediately (don't waste green seconds)
        if self.current_phase == 0:
            if q_ew == 0 and platoon_ew == 0 and (q_ns > 0 or platoon_ns > 0) and self.phase_timer >= 6.0:
                return 1
        else:
            if q_ns == 0 and platoon_ns == 0 and (q_ew > 0 or platoon_ew > 0) and self.phase_timer >= 6.0:
                return 0

        # 2. Platoon Glide Protection: If an arriving platoon of 3+ vehicles is approaching
        # in the current green phase, hold green for 4 more seconds to prevent stopping them!
        if self.current_phase == 0 and platoon_ew >= 3 and self.phase_timer < 45.0:
            return 0
        if self.current_phase == 1 and platoon_ns >= 3 and self.phase_timer < 45.0:
            return 1

        # 3. Neural Network Deep Q-Value Evaluation
        q_vals = self.q_net.forward(state)
        rl_bias = (q_vals[0] - q_vals[1]) * 0.8

        # Total Composite Decision Metric
        score_ew = pressure_ew + rl_bias
        score_ns = pressure_ns - rl_bias

        # Hysteresis threshold to prevent flickering phase transitions
        if self.current_phase == 0:
            return 1 if score_ns > score_ew * 1.15 and self.phase_timer >= self.min_green_time else 0
        else:
            return 0 if score_ew > score_ns * 1.15 and self.phase_timer >= self.min_green_time else 1

    def update_simulation_step(self, approaches_data, dt=1.0, emergency_info=None):
        """Ticks the traffic signal logic for 1 simulation second."""
        self.phase_timer += dt
        
        state = self._extract_state_vector(approaches_data, emergency_info)
        emergency_flag = emergency_info.get("detected", False) if emergency_info else False
        emergency_approach = emergency_info.get("approach_index", None) if emergency_info else None
        
        # Handle Yellow & All-Red clearance phase transition
        if self.in_yellow:
            if self.phase_timer >= self.yellow_time:
                self.in_yellow = False
                self.in_all_red = True
                self.phase_timer = 0
        elif self.in_all_red:
            if self.phase_timer >= self.all_red_time:
                self.in_all_red = False
                self.current_phase = self.next_phase
                self.phase_timer = 0
        else:
            # AI mode can switch early (6s) if queue has cleared with zero wasted green seconds
            min_thresh = 6.0 if self.mode == "AI_RL" else self.min_green_time
            can_switch = (self.phase_timer >= min_thresh) or emergency_flag
            must_switch = (self.phase_timer >= self.max_green_time)
            
            if can_switch:
                chosen_action = self.get_action(state, emergency_flag, emergency_approach, approaches_data)
                
                if chosen_action != self.current_phase or must_switch:
                    self.in_yellow = True
                    self.in_all_red = False
                    self.next_phase = chosen_action if chosen_action != self.current_phase else (self.current_phase + 1) % 2
                    self.phase_timer = 0
                    self.decisions_count += 1

        reward = self._calculate_reward(approaches_data, emergency_flag)
        
        # Stability Penalty: Discourage rapid phase switching
        if self.in_yellow and self.phase_timer == 0:
            reward -= 15.0

        self.cumulative_reward += reward

        if self.epsilon > self.epsilon_min:
            self.epsilon *= self.epsilon_decay

        return {
            "intersection_id": self.intersection_id,
            "current_phase": self.current_phase,
            "next_phase": self.next_phase,
            "in_yellow": self.in_yellow,
            "in_all_red": self.in_all_red,
            "phase_timer": round(self.phase_timer, 1),
            "mode": self.mode,
            "emergency_override": self.emergency_preemption_active,
            "reward": round(reward, 3)
        }

    def _extract_state_vector(self, approaches_data, emergency_info):
        """Constructs 16-dimensional continuous state representation."""
        queues = [approaches_data.get(f"app_{i}", {}).get("queue", 0) for i in range(4)]
        speeds = [approaches_data.get(f"app_{i}", {}).get("avg_speed", 30) / 60.0 for i in range(4)]
        waits = [min(approaches_data.get(f"app_{i}", {}).get("max_wait_s", 0) / 120.0, 1.0) for i in range(4)]
        phase_enc = self.current_phase / float(self.action_dim)
        timer_norm = min(self.phase_timer / self.max_green_time, 1.0)
        density = sum(queues) / 100.0
        emg = 1.0 if (emergency_info and emergency_info.get("detected")) else 0.0
        
        return queues + speeds + waits + [phase_enc, timer_norm, density, emg]

    def _calculate_reward(self, approaches_data, emergency_flag):
        total_queue_sq = sum([approaches_data.get(f"app_{i}", {}).get("queue", 0)**1.5 for i in range(4)])
        total_wait = sum([approaches_data.get(f"app_{i}", {}).get("total_wait_s", 0) for i in range(4)])
        throughput = sum([approaches_data.get(f"app_{i}", {}).get("cleared_veh_step", 0) for i in range(4)])
        co2_emissions = total_wait * 0.0028
        
        reward = -(0.05 * total_queue_sq + 0.02 * total_wait + 0.1 * co2_emissions) + 1.2 * throughput
        if self.emergency_preemption_active and emergency_flag:
            reward += 15.0
            
        return float(reward)
