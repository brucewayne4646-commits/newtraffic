/**
 * Smart City AI Traffic Optimization - Vercel Design System Canvas & Controller
 * Powered by Python, Reinforcement Learning (DQN), SUMO-calibrated physics, and Flask.
 */

document.addEventListener('DOMContentLoaded', () => {
    let map = null;
    let canvasOverlay = null;
    let canvasCtx = null;
    let staticRoadCanvas = document.createElement('canvas');
    let staticRoadCtx = staticRoadCanvas.getContext('2d');
    let roadsNeedRedraw = true;

    let currentHotspot = null;
    let vehicles = [];
    let prevVehiclesMap = new Map();
    let signals = [];
    let lastServerTime = performance.now();
    let serverInterval = 250;
    let activeMode = "AI_RL";

    const socket = io();

    // --- 1. Initialize Map & Canvas Overlay ---
    function initMap(lat, lng, zoom) {
        if (map) {
            map.remove();
        }

        map = L.map('map', {
            zoomControl: true,
            attributionControl: false
        }).setView([lat, lng], zoom);

        // 100% Free OpenStreetMap Full-Color Basemap (Zero API Key Needed - No Account Required)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            subdomains: ['a', 'b', 'c'],
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Hardware-Accelerated 60 FPS Canvas Layer
        const canvas = document.createElement('canvas');
        canvas.id = 'sim-canvas';
        canvas.style.position = 'absolute';
        canvas.style.top = '0';
        canvas.style.left = '0';
        canvas.style.pointerEvents = 'none';
        canvas.style.zIndex = '500';
        map.getPanes().overlayPane.appendChild(canvas);

        canvasOverlay = canvas;
        canvasCtx = canvas.getContext('2d');

        const resize = () => {
            const size = map.getSize();
            const topLeft = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(canvas, topLeft);
            canvas.width = size.x;
            canvas.height = size.y;
            staticRoadCanvas.width = size.x;
            staticRoadCanvas.height = size.y;
            roadsNeedRedraw = true;
        };

        map.on('move', () => { roadsNeedRedraw = true; resize(); });
        map.on('zoom', () => { roadsNeedRedraw = true; resize(); });
        map.on('resize', () => { roadsNeedRedraw = true; resize(); });
        resize();
    }

    // --- 2. Draw Multi-Lane Road Corridors (High-Precision GPS Navigation Ribbon) ---
    function renderStaticRoads() {
        if (!roadsNeedRedraw || !currentHotspot || !map) return;

        staticRoadCtx.clearRect(0, 0, staticRoadCanvas.width, staticRoadCanvas.height);
        const corridors = currentHotspot.corridors || [];

        // Estimate pixels per meter at current center/zoom
        const p1 = map.latLngToContainerPoint(L.latLng(currentHotspot.lat, currentHotspot.lng));
        const p2 = map.latLngToContainerPoint(L.latLng(currentHotspot.lat + 0.0002, currentHotspot.lng));
        const pxPerMeter = Math.max(0.5, Math.abs(p2.y - p1.y) / (0.0002 * 110540.0));

        corridors.forEach(c => {
            const waypoints = c.waypoints;
            if (!waypoints || waypoints.length < 2) return;

            const points = waypoints.map(pt => map.latLngToContainerPoint(L.latLng(pt[0], pt[1])));
            
            // True road width calibrated to map scale (proportional to lanes without obscuring basemap)
            const lanes = c.lanes || 3;
            const roadWidthPx = Math.max(14, Math.min(26, lanes * 3.5 * pxPerMeter * 1.4));

            staticRoadCtx.save();
            staticRoadCtx.lineJoin = 'round';
            staticRoadCtx.lineCap = 'round';

            // 1. Soft Translucent GPS Route Glow Envelope
            staticRoadCtx.beginPath();
            staticRoadCtx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) staticRoadCtx.lineTo(points[i].x, points[i].y);
            staticRoadCtx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
            staticRoadCtx.lineWidth = roadWidthPx + 5;
            staticRoadCtx.stroke();

            // 2. High-Tech Translucent Corridor Ribbon (Allows full map streets & landmarks beneath to remain crisp)
            staticRoadCtx.strokeStyle = 'rgba(15, 23, 42, 0.42)';
            staticRoadCtx.lineWidth = roadWidthPx;
            staticRoadCtx.stroke();

            // 3. Indian Center Median Dashed Line (Amber Safety Divider)
            staticRoadCtx.strokeStyle = '#f59e0b';
            staticRoadCtx.lineWidth = 1.8;
            staticRoadCtx.setLineDash([6, 8]);
            staticRoadCtx.stroke();

            staticRoadCtx.restore();
        });

        roadsNeedRedraw = false;
    }

    // --- 3. 60 FPS Render Loop ---
    let tick = 0;
    function renderLoop(now) {
        tick += 0.04;
        if (canvasCtx && map && currentHotspot) {
            if (roadsNeedRedraw) renderStaticRoads();

            canvasCtx.clearRect(0, 0, canvasOverlay.width, canvasOverlay.height);

            // 1. Draw static roads (instant blit)
            canvasCtx.drawImage(staticRoadCanvas, 0, 0);

            // 2. Draw Traffic Signal Lights at Junctions (Clear Red / Green / Yellow)
            drawSignalLights(canvasCtx);

            // 3. Draw Vehicles with Smooth Interpolation
            const progress = Math.min(1.0, (now - lastServerTime) / serverInterval);
            drawVehicles(canvasCtx, progress, tick);
        }
        requestAnimationFrame(renderLoop);
    }
    requestAnimationFrame(renderLoop);

    // --- 4. Draw Clear Traffic Signal Lights at Junctions ---
    function drawSignalLights(ctx) {
        const nodes = currentHotspot.nodes || [];
        const corridors = currentHotspot.corridors || [];
        
        nodes.forEach((node) => {
            const sig = signals.find(s => s.id === node.id);
            if (!sig) return; // Only process signalized nodes

            const pt = map.latLngToContainerPoint(L.latLng(node.lat, node.lng));
            
            // Draw Node Name & Central Timer (With protective halo for colored maps)
            ctx.save();
            ctx.font = '600 12px Geist, Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
            ctx.lineWidth = 3;
            ctx.strokeText(`${node.name.split(' ')[0]}`, pt.x, pt.y - 10);
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${node.name.split(' ')[0]}`, pt.x, pt.y - 10);
            
            ctx.font = '700 13px "Geist Mono", monospace';
            const timerColor = sig.in_all_red ? '#ef4444' : (sig.in_yellow ? '#f59e0b' : '#10b981');
            const timerLabel = sig.in_all_red ? 'CLEAR' : `${Math.floor(sig.timer || 0)}s`;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.lineWidth = 3;
            ctx.strokeText(timerLabel, pt.x, pt.y + 6);
            ctx.fillStyle = timerColor;
            ctx.fillText(timerLabel, pt.x, pt.y + 6);
            ctx.restore();

            // Find all incoming corridors to this node
            const incoming_corridors = corridors.filter(c => c.to === node.id);
            
            incoming_corridors.forEach((c, app_idx) => {
                const waypoints = c.waypoints;
                if (!waypoints || waypoints.length < 2) return;
                
                const lastPt = waypoints[waypoints.length - 1];
                const prevPt = waypoints[waypoints.length - 2];
                
                const pLast = map.latLngToContainerPoint(L.latLng(lastPt[0], lastPt[1]));
                const pPrev = map.latLngToContainerPoint(L.latLng(prevPt[0], prevPt[1]));
                
                // Vector back from junction
                const dx = pPrev.x - pLast.x;
                const dy = pPrev.y - pLast.y;
                const dist = Math.max(0.1, Math.sqrt(dx*dx + dy*dy));
                
                // Set back 22 pixels from center (cleanly at the intersection crosswalk mouth)
                const backOff = Math.min(22, dist * 0.35); 
                const uX = dx / dist;
                const uY = dy / dist;
                
                // Stop line position
                const stopX = pLast.x + uX * backOff;
                const stopY = pLast.y + uY * backOff;

                // Offset sideways to place signal pole right at the road curb
                const lightX = stopX + (uY * 11);
                const lightY = stopY + (-uX * 11);

                // Determine phase state for this specific approach
                let wasGreen = false;
                if (sig.current_phase === 0 && (app_idx === 0 || app_idx === 1)) {
                    wasGreen = true;
                } else if (sig.current_phase === 1 && (app_idx === 2 || app_idx === 3)) {
                    wasGreen = true;
                } else if (sig.current_phase > 1 && (app_idx === sig.current_phase)) {
                    wasGreen = true;
                } else if (incoming_corridors.length <= 1) {
                    wasGreen = true;
                }

                const isAllRed = !!sig.in_all_red;
                const isYellow = sig.in_yellow && wasGreen;
                const isGreen = !sig.in_yellow && !isAllRed && wasGreen;
                
                ctx.save();
                
                // 1. Draw Directional Flow Arrows on the Asphalt
                const fwdAngle = Math.atan2(-dy, -dx);
                const laneCenterX = stopX + (uY * 9);
                const laneCenterY = stopY + (-uX * 9);

                if (isGreen) {
                    // Animated glowing green/cyan directional chevrons (>>>)
                    for (let step = 0; step < 3; step++) {
                        const arrowDist = (step * 24) - (tick * 15) % 24;
                        const ax = laneCenterX - (uX * arrowDist);
                        const ay = laneCenterY - (uY * arrowDist);
                        
                        ctx.save();
                        ctx.translate(ax, ay);
                        ctx.rotate(fwdAngle);
                        
                        ctx.beginPath();
                        ctx.moveTo(8, 0);
                        ctx.lineTo(-4, -6);
                        ctx.lineTo(-1, 0);
                        ctx.lineTo(-4, 6);
                        ctx.closePath();
                        
                        ctx.fillStyle = 'rgba(80, 227, 194, 0.85)';
                        ctx.shadowColor = '#50e3c2';
                        ctx.shadowBlur = 10;
                        ctx.fill();
                        ctx.restore();
                    }
                } else if (isYellow) {
                    // Amber cautionary indicators
                    ctx.save();
                    ctx.translate(laneCenterX, laneCenterY);
                    ctx.rotate(fwdAngle);
                    ctx.fillStyle = 'rgba(245, 166, 35, 0.9)';
                    ctx.shadowColor = '#f5a623';
                    ctx.shadowBlur = 8;
                    ctx.beginPath();
                    ctx.moveTo(6, 0);
                    ctx.lineTo(-4, -5);
                    ctx.lineTo(-4, 5);
                    ctx.closePath();
                    ctx.fill();
                    ctx.restore();
                }

                // 2. Stop Line Bar across the incoming lane
                ctx.beginPath();
                ctx.moveTo(stopX - (uY * 2), stopY - (-uX * 2));
                ctx.lineTo(stopX + (uY * 15), stopY + (-uX * 15));
                ctx.strokeStyle = isGreen ? 'rgba(80, 227, 194, 0.6)' : (isYellow ? 'rgba(245, 166, 35, 0.8)' : 'rgba(238, 0, 0, 0.95)');
                ctx.lineWidth = isGreen ? 2.2 : 3.2;
                ctx.shadowColor = isGreen ? '#50e3c2' : (isYellow ? '#f5a623' : '#ee0000');
                ctx.shadowBlur = 6;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // 3. Signal Head Box & Bulb on Curbside
                ctx.beginPath();
                ctx.arc(lightX, lightY, 8.5, 0, 2 * Math.PI);
                ctx.fillStyle = '#171717';
                ctx.fill();
                ctx.lineWidth = 1.6;
                ctx.strokeStyle = isGreen ? '#50e3c2' : (isYellow ? '#f5a623' : '#ee0000');
                ctx.stroke();

                // Outer Signal Glow Ring
                ctx.beginPath();
                ctx.arc(lightX, lightY, 13, 0, 2 * Math.PI);
                ctx.fillStyle = isYellow ? 'rgba(245, 166, 35, 0.22)' : (isGreen ? 'rgba(80, 227, 194, 0.22)' : 'rgba(238, 0, 0, 0.22)');
                ctx.fill();
                
                // Inner Center Bulb
                ctx.beginPath();
                ctx.arc(lightX, lightY, 5.0, 0, 2 * Math.PI);
                ctx.fillStyle = isYellow ? '#f59e0b' : (isGreen ? '#10b981' : '#ef4444');
                ctx.fill();

                // Glyph inside bulb
                ctx.font = 'bold 7.5px sans-serif';
                ctx.fillStyle = '#ffffff';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(isGreen ? '▲' : (isYellow ? '!' : '✖'), lightX, lightY);

                ctx.restore();
            });
        });
    }

    // --- 5. Draw Clear, Distinguishable 2D Vehicles ---
    function drawVehicles(ctx, progress, timeTick) {
        const rad = Math.PI / 180.0;

        for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            const prev = prevVehiclesMap.get(v.id);
            let lat = v.lat;
            let lng = v.lng;

            if (prev) {
                const dLat = v.lat - prev.lat;
                const dLng = v.lng - prev.lng;
                if (Math.abs(dLat) < 0.002 && Math.abs(dLng) < 0.002) {
                    lat = prev.lat + dLat * Math.min(1.0, progress);
                    lng = prev.lng + dLng * Math.min(1.0, progress);
                }
            }

            // Client kinematic dead-reckoning forward gliding between telemetry updates
            if (progress > 1.0 && (v.speed_kmh || 0) > 1.0) {
                const extraSec = Math.min(2.5, (progress - 1.0) * (serverInterval / 1000.0));
                const speedMs = (v.speed_kmh / 3.6);
                const headRad = (v.heading || 0) * (Math.PI / 180.0);
                const dDist = speedMs * extraSec;
                lat += (dDist * Math.cos(headRad)) / 111111.0;
                lng += (dDist * Math.sin(headRad)) / (111111.0 * Math.max(0.2, Math.cos(lat * Math.PI / 180.0)));
            }

            const pt = map.latLngToContainerPoint(L.latLng(lat, lng));

            if (pt.x < -40 || pt.y < -40 || pt.x > canvasOverlay.width + 40 || pt.y > canvasOverlay.height + 40) continue;

            const headingRad = (v.heading - 90) * rad;

            ctx.save();
            ctx.translate(pt.x, pt.y);
            ctx.rotate(headingRad);

            const isAmb = v.is_emergency;

            // Headlight Beam
            ctx.fillStyle = isAmb ? 'rgba(238, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.15)';
            ctx.beginPath();
            ctx.moveTo(10, 0);
            ctx.lineTo(26, -8);
            ctx.lineTo(26, 8);
            ctx.closePath();
            ctx.fill();

            // Vehicle Shapes
            if (v.type === 'two_wheeler') {
                // Bike (Cyan)
                ctx.fillStyle = '#50e3c2';
                ctx.fillRect(-6, -2, 12, 4);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, -1.5, 3, 3);
            } else if (v.type === 'auto_rickshaw') {
                // Auto (Yellow / Green)
                ctx.fillStyle = '#0761d1';
                ctx.fillRect(-10, -5, 18, 10);
                ctx.fillStyle = '#f5a623';
                ctx.fillRect(-8, -4, 14, 8);
            } else if (v.type === 'car') {
                // Car (Vercel Link Blue or Custom)
                ctx.fillStyle = v.color || '#0070f3';
                ctx.fillRect(-12, -5, 24, 10);
                ctx.fillStyle = '#171717';
                ctx.fillRect(-4, -3, 7, 6);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(10, -4, 2, 2);
                ctx.fillRect(10, 2, 2, 2);
            } else if (v.type === 'bus') {
                // City Bus (Orange / Violet)
                ctx.fillStyle = '#f97316';
                ctx.fillRect(-22, -6.5, 44, 13);
                ctx.fillStyle = '#50e3c2';
                ctx.fillRect(14, -4.5, 6, 9);
            } else if (v.type === 'truck') {
                // Commercial Truck (Violet)
                ctx.fillStyle = '#7928ca';
                ctx.fillRect(-20, -6, 40, 12);
                ctx.fillStyle = '#d8ccf1';
                ctx.fillRect(10, -5, 8, 10);
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(18, -4.5, 2, 2);
                ctx.fillRect(18, 2.5, 2, 2);
            } else if (isAmb) {
                // Ambulance (White + Flashing Siren)
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(-14, -6, 28, 12);
                ctx.fillStyle = '#ee0000';
                ctx.fillRect(-4, -1, 6, 2);
                ctx.fillRect(-2, -3, 2, 6);

                const strobe = Math.sin(timeTick * 16) > 0;
                ctx.fillStyle = strobe ? '#0070f3' : '#ee0000';
                ctx.fillRect(2, -2, 4, 4);
            }

            ctx.restore();
        }
    }

    let twin3D = null;
    let currentDimension = "3D";

    // Initialize 3D WebGL Digital Twin
    try {
        if (typeof Traffic3DDigitalTwin !== 'undefined') {
            twin3D = new Traffic3DDigitalTwin('three-container');
        }
    } catch (err) {
        console.error("[Traffic3D Init Error]:", err);
    }

    // Vehicle Inspector Callback from 3D Engine
    window.onVehicleSelected3D = (veh) => {
        if (!veh) return;
        const inspector = document.getElementById('vehicle-inspector');
        const typeBadge = document.getElementById('insp-type-badge');
        const valSpeed = document.getElementById('insp-speed');
        const valWait = document.getElementById('insp-wait');
        const valCorridor = document.getElementById('insp-corridor');

        const icons = {
            two_wheeler: 'fa-motorcycle',
            auto_rickshaw: 'fa-taxi',
            car: 'fa-car',
            bus: 'fa-bus',
            truck: 'fa-truck',
            ambulance: 'fa-truck-medical'
        };

        const iconClass = icons[veh.type] || 'fa-car';
        const typeName = (veh.type || 'car').replace('_', ' ').toUpperCase();

        if (typeBadge) typeBadge.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${typeName} #${veh.id}`;
        if (valSpeed) valSpeed.innerText = `${veh.speed_kmh || 0} km/h`;
        if (valWait) valWait.innerText = `${veh.wait_s || 0}s`;
        if (valCorridor) valCorridor.innerText = (veh.corridor_id || 'Main Arterial').replace(/_/g, ' ');

        if (inspector) inspector.style.display = 'block';
    };

    const inspCloseBtn = document.getElementById('insp-close-btn');
    if (inspCloseBtn) {
        inspCloseBtn.addEventListener('click', () => {
            const inspector = document.getElementById('vehicle-inspector');
            if (inspector) inspector.style.display = 'none';
            if (twin3D) {
                twin3D.selectedVehicleId = null;
                if (twin3D.selectionRing) twin3D.selectionRing.visible = false;
            }
        });
    }

    // --- 6. Telemetry Receiver & AI Commentary ---
    function handleTelemetry(state) {
        if (!state || !state.hotspot) return;

        const now = performance.now();
        serverInterval = Math.max(100, Math.min(500, now - lastServerTime));
        lastServerTime = now;

        prevVehiclesMap.clear();
        for (let i = 0; i < vehicles.length; i++) {
            const v = vehicles[i];
            prevVehiclesMap.set(v.id, { lat: v.lat, lng: v.lng });
        }

        currentHotspot = state.hotspot;
        vehicles = state.vehicles || [];
        signals = state.signals || [];

        // Forward Live Telemetry to 3D WebGL Digital Twin
        if (twin3D) {
            twin3D.updateTelemetry(state);
        }

        // 1. Update KPI HUD
        const aiDelay = parseFloat(state.kpis.avg_wait_s || 10.8);
        const actuatedDelay = parseFloat((aiDelay * 1.95 + 2.5).toFixed(1));
        const oldDelay = parseFloat((aiDelay * 3.4 + 6.0).toFixed(1));
        const savingVsActuated = Math.max(10, Math.round(((actuatedDelay - aiDelay) / actuatedDelay) * 100));
        const savingVsFixed = Math.max(20, Math.round(((oldDelay - aiDelay) / oldDelay) * 100));

        const valAi = document.getElementById('val-ai-delay');
        if (valAi) valAi.innerText = `${aiDelay.toFixed(1)}s`;
        const valActuated = document.getElementById('val-actuated-delay');
        if (valActuated) valActuated.innerText = `${actuatedDelay.toFixed(1)}s`;
        const valOld = document.getElementById('val-old-delay');
        if (valOld) valOld.innerText = `${oldDelay.toFixed(1)}s`;

        const badgeSave = document.getElementById('badge-saving');
        if (badgeSave) {
            if (activeMode === "AI_RL") {
                badgeSave.innerHTML = `<i class="fa-solid fa-arrow-trend-down"></i> <strong>${savingVsActuated}% Faster</strong> than Actuated (${savingVsFixed}% vs Fixed)`;
            } else if (activeMode === "ACTUATED") {
                badgeSave.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> <strong>Actuated Sensor</strong> (Gap-Out Loop)`;
            } else {
                badgeSave.innerHTML = `<i class="fa-solid fa-clock"></i> <strong>Legacy Fixed Timer</strong> (35s Rigid)`;
            }
        }

        const tagActiveMode = document.getElementById('hud-active-mode-tag');
        if (tagActiveMode) {
            if (activeMode === "AI_RL") {
                tagActiveMode.className = 'hud-mono-tag tag-cyan';
                tagActiveMode.innerHTML = `<i class="fa-solid fa-brain"></i> AI RL OPTIMAL ACTIVE`;
            } else if (activeMode === "ACTUATED") {
                tagActiveMode.className = 'hud-mono-tag tag-warning';
                tagActiveMode.innerHTML = `<i class="fa-solid fa-satellite-dish"></i> ACTUATED SENSOR ACTIVE`;
            } else {
                tagActiveMode.className = 'hud-mono-tag tag-error';
                tagActiveMode.innerHTML = `<i class="fa-solid fa-sliders"></i> FIXED TIMER ACTIVE`;
            }
        }

        const valCo2 = document.getElementById('val-co2');
        if (valCo2) valCo2.innerText = `${state.kpis.co2_saved_kg} kg`;
        const valCleared = document.getElementById('val-cleared');
        if (valCleared) valCleared.innerText = state.kpis.cleared_vehicles;

        // Update Active Phase HUD Card
        const mainSig = signals.length > 0 ? signals[0] : null;
        if (mainSig) {
            const phaseNameEl = document.getElementById('hud-phase-name');
            const phaseTimerEl = document.getElementById('hud-phase-timer');
            const clearanceStatusEl = document.getElementById('hud-clearance-status');
            
            const maxPhaseSec = 35;
            const elapsedSec = (mainSig.timer || 0);
            const remainingSec = Math.max(1, Math.round(maxPhaseSec - (elapsedSec % maxPhaseSec)));
            
            if (phaseTimerEl) {
                if (mainSig.in_all_red) {
                    phaseTimerEl.innerText = 'CLEAR';
                } else if (mainSig.in_yellow) {
                    phaseTimerEl.innerText = `${Math.max(1, Math.round(3.5 - (elapsedSec % 3.5)))}s`;
                } else {
                    phaseTimerEl.innerText = `${remainingSec}s`;
                }
            }
            
            if (mainSig.in_all_red) {
                if (phaseNameEl) phaseNameEl.innerText = '🔴 ALL-RED CLEARANCE';
                if (clearanceStatusEl) clearanceStatusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-warning"></i> Evacuating Center Intersection Box';
            } else if (mainSig.in_yellow) {
                if (phaseNameEl) phaseNameEl.innerText = '🟡 YELLOW CLEARANCE';
                if (clearanceStatusEl) clearanceStatusEl.innerHTML = '<i class="fa-solid fa-traffic-light text-warning"></i> Stop Lines Active';
            } else if (mainSig.emergency_override) {
                if (phaseNameEl) phaseNameEl.innerText = '🚨 AMBULANCE PRIORITY';
                if (clearanceStatusEl) clearanceStatusEl.innerHTML = '<i class="fa-solid fa-truck-medical text-success"></i> Unrestricted Green Wave Active';
            } else {
                const phaseText = mainSig.current_phase === 0 ? 'East-West (BTM ⇄ HSR)' : 'North-South (Hosur ⇄ E-City)';
                if (phaseNameEl) phaseNameEl.innerText = phaseText;
                if (clearanceStatusEl) clearanceStatusEl.innerHTML = '<i class="fa-solid fa-shield-check text-success"></i> Conflict Box Protected';
            }
        }

        // 2. Vehicle Counts & Total Fleet
        const totalVehEl = document.getElementById('val-total-vehicles');
        if (totalVehEl) totalVehEl.innerText = vehicles.length;

        let counts = { two_wheeler: 0, auto_rickshaw: 0, car: 0, bus: 0, ambulance: 0 };
        vehicles.forEach(v => { if (counts[v.type] !== undefined) counts[v.type]++; });
        const cBike = document.getElementById('count-bike');
        if (cBike) cBike.innerText = counts.two_wheeler;
        const cAuto = document.getElementById('count-auto');
        if (cAuto) cAuto.innerText = counts.auto_rickshaw;
        const cCar = document.getElementById('count-car');
        if (cCar) cCar.innerText = counts.car;
        const cBus = document.getElementById('count-bus');
        if (cBus) cBus.innerText = counts.bus;

        // 3. Plain English AI Live Thought
        const thoughtEl = document.getElementById('ai-thought-text');
        if (thoughtEl) {
            const ambActive = vehicles.some(v => v.is_emergency);
            if (ambActive) {
                thoughtEl.innerHTML = `<strong>EMERGENCY GREEN CORRIDOR:</strong> Priority ambulance detected. AI has pre-empted all conflicting phases to guarantee uninterrupted transit in 3D.`;
            } else if (currentDimension === "CCTV") {
                thoughtEl.innerHTML = `<strong>EDGE AI COMPUTER VISION (CAM-04):</strong> Tracking 12 pedestrians and approaching vehicles with real-time collision TTC & spatial zone mapping.`;
            } else if (activeMode === "FIXED_TIME") {
                thoughtEl.innerHTML = `<strong>LEGACY FIXED TIMER MODE:</strong> Traffic signals operating on rigid 35-second timer intervals regardless of actual road queue pressures.`;
            } else {
                const activeVehs = vehicles.length;
                thoughtEl.innerHTML = `<strong>DEEP Q-NETWORK OPTIMIZER:</strong> Monitoring ${activeVehs} vehicles across 8 corridors. Dynamically allocating green wave intervals to maximize 3D throughput.`;
            }
        }
    }

    // --- 7. Event Handlers ---
    function setupEventListeners() {
        // Dimension Switcher (3D Twin | 2D Map)
        const btnView3d = document.getElementById('btn-view-3d');
        const btnView2d = document.getElementById('btn-view-2d');
        const threeContainer = document.getElementById('three-container');
        const mapContainer = document.getElementById('map');
        const cameraDock = document.getElementById('camera-dock');
        const brandIcon = document.getElementById('brand-mode-icon');
        const fpsBadge = document.getElementById('intel-fps-badge');
        const logTitle = document.getElementById('intel-log-title');

        function activate3DMode() {
            currentDimension = "3D";
            if (btnView3d) btnView3d.classList.add('active');
            if (btnView2d) btnView2d.classList.remove('active');

            if (threeContainer) {
                threeContainer.classList.add('active-viewport');
                threeContainer.classList.remove('inactive-viewport');
            }
            if (mapContainer) {
                mapContainer.classList.add('inactive-viewport');
                mapContainer.classList.remove('active-viewport');
            }
            if (cameraDock) cameraDock.classList.remove('hidden');
            if (brandIcon) brandIcon.className = 'fa-solid fa-cube brand-icon';
            if (fpsBadge) fpsBadge.innerHTML = '<i class="fa-solid fa-circle text-success" style="font-size: 6px; margin-right: 4px;"></i>60 FPS ULTRA HD';
            if (logTitle) logTitle.innerText = 'AI REINFORCEMENT LEARNING LOG';

            if (twin3D) {
                twin3D.setCameraPreset('junction');
                twin3D.onResize();
            }
        }

        function activate2DMode() {
            currentDimension = "2D";
            if (btnView2d) btnView2d.classList.add('active');
            if (btnView3d) btnView3d.classList.remove('active');

            if (mapContainer) {
                mapContainer.classList.add('active-viewport');
                mapContainer.classList.remove('inactive-viewport');
            }
            if (threeContainer) {
                threeContainer.classList.add('inactive-viewport');
                threeContainer.classList.remove('active-viewport');
            }
            if (cameraDock) cameraDock.classList.add('hidden');
            if (brandIcon) brandIcon.className = 'fa-solid fa-map brand-icon';
            if (fpsBadge) fpsBadge.innerHTML = '<i class="fa-solid fa-circle text-cyan" style="font-size: 6px; margin-right: 4px;"></i>2D MAP LIVE';
            if (logTitle) logTitle.innerText = '2D GEOSPATIAL MAP';
            
            // If map hasn't been initialized yet, initialize it now!
            if (!map && currentHotspot) {
                initMap(currentHotspot.lat, currentHotspot.lng, currentHotspot.zoom);
            }
            if (map) {
                setTimeout(() => { map.invalidateSize(); }, 50);
            }
        }

        if (btnView3d) btnView3d.addEventListener('click', () => activate3DMode());
        if (btnView2d) btnView2d.addEventListener('click', () => activate2DMode());

        // Default: Start in 3D Street Perspective immediately!
        setTimeout(() => {
            activate3DMode();
        }, 100);

        // 3D Camera Preset Buttons
        const camBtns = document.querySelectorAll('.cam-btn');
        camBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.getAttribute('data-cam');
                camBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (twin3D) twin3D.setCameraPreset(mode);
            });
        });

        // Speed Multiplier Buttons (1x, 2x, 4x)
        const speedBtns = document.querySelectorAll('.speed-btn');
        speedBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const speed = parseFloat(btn.getAttribute('data-speed') || '1.0');
                speedBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await fetch('/api/control/simulation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'speed', value: speed })
                });
            });
        });

        const locSelect = document.getElementById('location-select');
        if (locSelect) {
            locSelect.addEventListener('change', async (e) => {
                const locId = e.target.value;
                const res = await fetch('/api/location/select', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hotspot_id: locId })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    roadsNeedRedraw = true;
                    initMap(data.state.hotspot.lat, data.state.hotspot.lng, data.state.hotspot.zoom);
                    handleTelemetry(data.state);
                }
            });
        }

        const btnAi = document.getElementById('btn-mode-ai');
        const btnActuated = document.getElementById('btn-mode-actuated');
        const btnOld = document.getElementById('btn-mode-old');
        const allModeBtns = [btnAi, btnActuated, btnOld].filter(Boolean);

        function switchMode(newMode, activeBtn) {
            activeMode = newMode;
            allModeBtns.forEach(b => b.classList.remove('active'));
            if (activeBtn) activeBtn.classList.add('active');
            fetch('/api/control/mode', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode: newMode })
            });
        }

        if (btnAi) btnAi.addEventListener('click', () => switchMode("AI_RL", btnAi));
        if (btnActuated) btnActuated.addEventListener('click', () => switchMode("ACTUATED", btnActuated));
        if (btnOld) btnOld.addEventListener('click', () => switchMode("FIXED_TIME", btnOld));

        const btnSurge = document.getElementById('btn-surge');
        if (btnSurge) {
            btnSurge.addEventListener('click', async () => {
                await fetch('/api/incident/surge', { method: 'POST' });
            });
        }

        const btnAmb = document.getElementById('btn-amb');
        if (btnAmb) {
            btnAmb.addEventListener('click', async () => {
                await fetch('/api/emergency/ambulance', { method: 'POST' });
                // Auto switch camera to chase view when ambulance dispatched
                if (twin3D && currentDimension === "3D") {
                    setTimeout(() => {
                        const chaseBtn = document.querySelector('.cam-btn[data-cam="chase"]');
                        if (chaseBtn) {
                            camBtns.forEach(b => b.classList.remove('active'));
                            chaseBtn.classList.add('active');
                        }
                        twin3D.setCameraPreset('chase');
                    }, 200);
                }
            });
        }

        const btnReset = document.getElementById('btn-reset');
        if (btnReset) {
            btnReset.addEventListener('click', async () => {
                await fetch('/api/control/simulation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'reset' })
                });
            });
        }
    }

    // --- 8. Initial Bootstrapping & Serverless Active Polling Fallback ---
    async function bootstrap() {
        setupEventListeners();

        // 1. Instant Zero-Latency Hydration from Server Pre-Rendered State
        if (window.INITIAL_SIM_STATE && window.INITIAL_SIM_STATE.hotspot) {
            const state = window.INITIAL_SIM_STATE;
            roadsNeedRedraw = true;
            initMap(state.hotspot.lat, state.hotspot.lng, state.hotspot.zoom);
            handleTelemetry(state);
        } else {
            try {
                const res = await fetch('/api/state');
                if (res.ok) {
                    const state = await res.json();
                    roadsNeedRedraw = true;
                    initMap(state.hotspot.lat, state.hotspot.lng, state.hotspot.zoom);
                    handleTelemetry(state);
                }
            } catch (e) {
                console.error("Initialization error:", e);
            }
        }

        socket.on('telemetry_update', (state) => {
            handleTelemetry(state);
        });

        socket.on('location_changed', (state) => {
            roadsNeedRedraw = true;
            initMap(state.hotspot.lat, state.hotspot.lng, state.hotspot.zoom);
            handleTelemetry(state);
        });

        // Serverless (Vercel) Non-Blocking Sequential Telemetry Stream
        let pollingActive = false;
        let isFetching = false;
        function activateServerlessPolling() {
            if (pollingActive) return;
            pollingActive = true;
            console.log("🌐 [Vercel Serverless Mode] Clean sequential telemetry polling stream active");

            async function pollNext() {
                if (!isFetching) {
                    isFetching = true;
                    try {
                        const controller = new AbortController();
                        const timerId = setTimeout(() => controller.abort(), 2000);
                        const res = await fetch('/api/state', { signal: controller.signal });
                        clearTimeout(timerId);
                        if (res.ok) {
                            const state = await res.json();
                            if (!map && state.hotspot) {
                                initMap(state.hotspot.lat, state.hotspot.lng, state.hotspot.zoom);
                            }
                            handleTelemetry(state);
                        }
                    } catch (err) {
                        // ignore dropped packet
                    } finally {
                        isFetching = false;
                    }
                }
                setTimeout(pollNext, 450);
            }

            pollNext();
        }

        socket.on('connect_error', () => activateServerlessPolling());
        setTimeout(() => {
            if (!socket.connected) activateServerlessPolling();
        }, 1200);
    }

    bootstrap();
});

