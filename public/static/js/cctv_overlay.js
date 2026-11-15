/**
 * Smart City Traffic AI - Edge AI Computer Vision CCTV Overlay (CAM-04)
 * Renders real-time AI Object Detection Bounding Boxes (YOLO/Edge Vision HUD),
 * Spatial Zones (Crosswalk, Carriageway, Footpath), Pedestrian Trackers,
 * Near-Miss Trajectory Conflict Vectors, and Live Inference Telemetry.
 */

class CCTVVisionOverlay {
    constructor(canvasId, threeTwin) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`[CCTVOverlay] Canvas #${canvasId} not found`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');
        this.threeTwin = threeTwin;
        this.active = false;
        this.camId = "CAM-04";
        this.showOverlays = true;
        this.startTime = performance.now();
        this.inferLatency = 22.3;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.render = this.render.bind(this);
        requestAnimationFrame(this.render);
    }

    resize() {
        if (!this.canvas) return;
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    setActive(isActive, camId = "CAM-04") {
        this.active = isActive;
        this.camId = camId;
        if (this.canvas) {
            this.canvas.style.display = isActive ? 'block' : 'none';
        }
        if (isActive) {
            this.resize();
        }
    }

    setCamera(camId) {
        this.camId = camId;
    }

    // Convert seconds to timecode format: 00:00:43:23
    getTimecode() {
        const elapsed = (performance.now() - this.startTime) / 1000;
        const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
        const frames = Math.floor((elapsed * 30) % 30).toString().padStart(2, '0');
        return `00:${mins}:${secs}:${frames}`;
    }

    render(now) {
        requestAnimationFrame(this.render);
        if (!this.active || !this.threeTwin || !this.ctx) return;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, width, height);

        if (!this.showOverlays) return;

        // Subtle edge AI inference latency jitter (21.2ms - 23.8ms)
        this.inferLatency = +(22.0 + Math.sin(now * 0.005) * 1.4 + Math.random() * 0.4).toFixed(1);

        // 1. Draw Spatial Zones (Crosswalk, Carriageway, Footpath-E, Footpath-W)
        this.drawSpatialZones(ctx, width, height);

        // 2. Project & Draw Pedestrian Bounding Boxes & Stick Outlines (Green)
        const projectedPedestrians = this.drawPedestrians(ctx, width, height);

        // 3. Project & Draw Vehicle Bounding Boxes (Cyan for Cars/Buses, Purple for Bikes)
        const projectedVehicles = this.drawVehicles(ctx, width, height);

        // 4. Calculate & Draw Near-Miss Trajectory Conflict Vectors & Warning Badges
        this.drawNearMissVectors(ctx, projectedVehicles, projectedPedestrians);

        // 5. Draw Broadcast CCTV HUD Overlays (Top Bar & Bottom Telemetry Bar)
        this.drawCCTVHud(ctx, width, height);
    }

    // --- 1. Draw Spatial Zones (Matching Reference Image) ---
    drawSpatialZones(ctx, width, height) {
        ctx.save();
        ctx.font = 'bold 9px "Geist Mono", "JetBrains Mono", monospace';

        // 1. CARRIAGEWAY (Bottom border line)
        ctx.strokeStyle = 'rgba(245, 166, 35, 0.45)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);

        const cyBottom = height - 55;
        ctx.beginPath();
        ctx.moveTo(0, cyBottom);
        ctx.lineTo(width, cyBottom);
        ctx.stroke();

        ctx.fillStyle = '#f5a623';
        ctx.fillRect(8, cyBottom - 14, 82, 14);
        ctx.fillStyle = '#000000';
        ctx.fillText('CARRIAGEWAY', 14, cyBottom - 4);

        ctx.fillStyle = '#f5a623';
        ctx.fillRect(width - 92, cyBottom - 14, 84, 14);
        ctx.fillStyle = '#000000';
        ctx.fillText('FOOTPATH-E', width - 86, cyBottom - 4);

        // 2. CROSSWALK ZONE POLYGON (Perspective Trapeze over Zebra Crossing)
        const p1 = this.threeTwin.getScreenCoordinates(new THREE.Vector3(-14, 0, -22));
        const p2 = this.threeTwin.getScreenCoordinates(new THREE.Vector3(14, 0, -22));
        const p3 = this.threeTwin.getScreenCoordinates(new THREE.Vector3(14, 0, -38));
        const p4 = this.threeTwin.getScreenCoordinates(new THREE.Vector3(-14, 0, -38));

        if (p1 && p2 && p3 && p4) {
            ctx.strokeStyle = 'rgba(245, 166, 35, 0.65)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineTo(p3.x, p3.y);
            ctx.lineTo(p4.x, p4.y);
            ctx.closePath();
            ctx.stroke();

            // Corner Anchor Dots
            [p1, p2, p3, p4].forEach(pt => {
                ctx.fillStyle = '#f5a623';
                ctx.fillRect(pt.x - 2.5, pt.y - 2.5, 5, 5);
            });

            // Crosswalk Tag
            ctx.fillStyle = '#f5a623';
            ctx.fillRect(p1.x, p1.y - 14, 76, 14);
            ctx.fillStyle = '#000000';
            ctx.fillText('CROSSWALK', p1.x + 6, p1.y - 4);
        }

        ctx.restore();
    }

    // --- 2. Project & Draw Pedestrian Bounding Boxes & Stick Human Figures (Green) ---
    drawPedestrians(ctx, width, height) {
        const peds = this.threeTwin.pedestrians || [];
        const projected = [];

        ctx.save();
        peds.forEach(ped => {
            const headPos = new THREE.Vector3(ped.position.x, ped.position.y + 1.8, ped.position.z);
            const feetPos = new THREE.Vector3(ped.position.x, ped.position.y, ped.position.z);

            const screenHead = this.threeTwin.getScreenCoordinates(headPos);
            const screenFeet = this.threeTwin.getScreenCoordinates(feetPos);

            if (!screenHead || !screenFeet) return;
            if (screenHead.z > 1.0 || screenHead.z < -1.0) return; // Behind camera or out of bounds

            const pedHeight = Math.max(26, Math.abs(screenFeet.y - screenHead.y));
            const pedWidth = Math.max(16, pedHeight * 0.45);
            const boxX = screenHead.x - pedWidth / 2;
            const boxY = screenHead.y;

            projected.push({
                id: ped.id,
                x: screenHead.x,
                y: screenHead.y + pedHeight / 2,
                boxX: boxX,
                boxY: boxY,
                width: pedWidth,
                height: pedHeight,
                worldPos: ped.position,
                inCrosswalk: ped.inCrosswalk
            });

            // 1. Green Bounding Box
            ctx.strokeStyle = '#50e3c2';
            ctx.lineWidth = 1.4;
            ctx.setLineDash([]);
            ctx.strokeRect(boxX, boxY, pedWidth, pedHeight);

            // 2. Corner Brackets
            const cornerLen = Math.min(6, pedWidth * 0.3);
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 2.0;
            // Top-left
            ctx.beginPath(); ctx.moveTo(boxX, boxY + cornerLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cornerLen, boxY); ctx.stroke();
            // Bottom-right
            ctx.beginPath(); ctx.moveTo(boxX + pedWidth - cornerLen, boxY + pedHeight); ctx.lineTo(boxX + pedWidth, boxY + pedHeight); ctx.lineTo(boxX + pedWidth, boxY + pedHeight - cornerLen); ctx.stroke();

            // 3. Stick Figure Human Silhouette Inside Bounding Box
            const cx = boxX + pedWidth / 2;
            const headR = Math.max(2.5, pedHeight * 0.12);
            ctx.strokeStyle = '#50e3c2';
            ctx.lineWidth = 1.2;

            // Head Circle
            ctx.beginPath();
            ctx.arc(cx, boxY + headR + 2, headR, 0, Math.PI * 2);
            ctx.stroke();

            // Torso
            const torsoY = boxY + headR * 2 + 3;
            const hipsY = boxY + pedHeight * 0.65;
            ctx.beginPath();
            ctx.moveTo(cx, torsoY);
            ctx.lineTo(cx, hipsY);
            ctx.stroke();

            // Legs
            ctx.beginPath();
            ctx.moveTo(cx, hipsY); ctx.lineTo(boxX + 2, boxY + pedHeight);
            ctx.moveTo(cx, hipsY); ctx.lineTo(boxX + pedWidth - 2, boxY + pedHeight);
            ctx.stroke();

            // Ground Circle Shadow Glow
            ctx.fillStyle = 'rgba(80, 227, 194, 0.18)';
            ctx.beginPath();
            ctx.ellipse(cx, screenFeet.y, pedWidth * 0.7, 4, 0, 0, Math.PI * 2);
            ctx.fill();

            // 4. Pedestrian Tag ID Badge (e.g. PED-0047)
            ctx.font = 'bold 8.5px "Geist Mono", "JetBrains Mono", monospace';
            ctx.fillStyle = '#000000';
            const tagText = `PED-${ped.id}`;
            const tagW = ctx.measureText(tagText).width + 6;
            ctx.fillRect(boxX, boxY - 12, tagW, 11);
            ctx.fillStyle = '#50e3c2';
            ctx.fillText(tagText, boxX + 3, boxY - 3);
        });

        ctx.restore();
        return projected;
    }

    // --- 3. Project & Draw Vehicle Bounding Boxes (Cyan / Purple) ---
    drawVehicles(ctx, width, height) {
        const vehicles = this.threeTwin.vehicleMeshes || new Map();
        const projected = [];

        ctx.save();
        for (const [id, vEntry] of vehicles.entries()) {
            const vehMesh = vEntry.group;
            if (!vehMesh) continue;

            const vehPos = vehMesh.position;
            const isTwoWheeler = (vEntry.type === 'two_wheeler');
            const isAmbulance = (vEntry.type === 'ambulance');

            const topPos = new THREE.Vector3(vehPos.x, vehPos.y + (isTwoWheeler ? 1.8 : 2.4), vehPos.z);
            const basePos = new THREE.Vector3(vehPos.x, vehPos.y, vehPos.z);

            const screenTop = this.threeTwin.getScreenCoordinates(topPos);
            const screenBase = this.threeTwin.getScreenCoordinates(basePos);

            if (!screenTop || !screenBase) continue;
            if (screenTop.z > 1.0 || screenTop.z < -1.0) continue;

            // Calculate Box Dimensions
            const vHeight = Math.max(30, Math.abs(screenBase.y - screenTop.y) * 1.5);
            const vWidth = isTwoWheeler ? vHeight * 0.55 : vHeight * 1.2;
            const boxX = screenTop.x - vWidth / 2;
            const boxY = screenTop.y - vHeight * 0.2;

            const boxColor = isTwoWheeler ? '#b388ff' : (isAmbulance ? '#ff0055' : '#00f0ff');
            const tagPrefix = isTwoWheeler ? 'CYC' : 'VEH';

            projected.push({
                id: id,
                type: vEntry.type,
                x: screenTop.x,
                y: screenTop.y + vHeight / 2,
                boxX: boxX,
                boxY: boxY,
                width: vWidth,
                height: vHeight,
                worldPos: vehPos,
                isTwoWheeler: isTwoWheeler,
                isAmbulance: isAmbulance
            });

            // 1. Vehicle Bounding Box
            ctx.strokeStyle = boxColor;
            ctx.lineWidth = 1.6;
            ctx.setLineDash([]);
            ctx.strokeRect(boxX, boxY, vWidth, vHeight);

            // 2. Corner Brackets
            const cornerLen = Math.min(8, vWidth * 0.25);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.2;
            // Top-left
            ctx.beginPath(); ctx.moveTo(boxX, boxY + cornerLen); ctx.lineTo(boxX, boxY); ctx.lineTo(boxX + cornerLen, boxY); ctx.stroke();
            // Bottom-right
            ctx.beginPath(); ctx.moveTo(boxX + vWidth - cornerLen, boxY + vHeight); ctx.lineTo(boxX + vWidth, boxY + vHeight); ctx.lineTo(boxX + vWidth, boxY + vHeight - cornerLen); ctx.stroke();

            // 3. Vehicle Tag ID (e.g. VEH-0039)
            ctx.font = 'bold 9px "Geist Mono", "JetBrains Mono", monospace';
            const tagText = `${tagPrefix}-${id}`;
            const tagW = ctx.measureText(tagText).width + 8;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
            ctx.fillRect(boxX, boxY - 14, tagW, 13);
            ctx.fillStyle = boxColor;
            ctx.fillText(tagText, boxX + 4, boxY - 4);
        }

        ctx.restore();
        return projected;
    }

    // --- 4. Draw Near-Miss Trajectory Conflict Vectors & Warning Badges ---
    drawNearMissVectors(ctx, vehicles, pedestrians) {
        if (!vehicles.length || !pedestrians.length) return;

        ctx.save();
        vehicles.forEach(veh => {
            // Find nearby crosswalk pedestrians
            pedestrians.forEach(ped => {
                const dist3D = veh.worldPos.distanceTo(ped.worldPos);

                // Near-miss trigger zone: vehicle within 6m to 25m of pedestrian approaching crosswalk
                if (dist3D > 4.0 && dist3D < 32.0 && (ped.inCrosswalk || Math.abs(ped.worldPos.z - veh.worldPos.z) < 22)) {
                    const dx = ped.x - veh.x;
                    const dy = ped.y - veh.y;
                    const pixelDist = Math.round(Math.sqrt(dx * dx + dy * dy));
                    const ttcSec = Math.max(0.45, (dist3D / 12.0)).toFixed(2);

                    // 1. Red Dynamic Conflict Trajectory Line
                    ctx.strokeStyle = '#ff0033';
                    ctx.lineWidth = 1.8;
                    ctx.setLineDash([]);
                    ctx.beginPath();
                    ctx.moveTo(veh.x, veh.y);
                    ctx.lineTo(ped.x, ped.y);
                    ctx.stroke();

                    // 2. Concentric Target Reticle on Pedestrian
                    ctx.strokeStyle = '#ff0033';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(ped.x, ped.y, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff0033';
                    ctx.fill();

                    // Concentric Target Reticle on Vehicle
                    ctx.beginPath();
                    ctx.arc(veh.x, veh.y, 6, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(veh.x, veh.y, 2.5, 0, Math.PI * 2);
                    ctx.fillStyle = '#ff0033';
                    ctx.fill();

                    // 3. Glowing Red Warning Tag Badge: NEAR MISS 67px / 0.65s
                    const midX = (veh.x + ped.x) / 2 + 15;
                    const midY = (veh.y + ped.y) / 2;

                    ctx.font = 'bold 9px "Geist Mono", "JetBrains Mono", monospace';
                    const warningText = `NEAR MISS  ${pixelDist}px / ${ttcSec}s`;
                    const wWidth = ctx.measureText(warningText).width + 12;

                    // Red Box with Dark Glow
                    ctx.fillStyle = '#770011';
                    ctx.fillRect(midX, midY - 12, wWidth, 16);
                    ctx.strokeStyle = '#ff0033';
                    ctx.lineWidth = 1.2;
                    ctx.strokeRect(midX, midY - 12, wWidth, 16);

                    // Text
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(warningText, midX + 6, midY);

                    // Indicator Line to Midpoint
                    ctx.strokeStyle = '#ff0033';
                    ctx.beginPath();
                    ctx.moveTo(midX, midY - 4);
                    ctx.lineTo((veh.x + ped.x) / 2, (veh.y + ped.y) / 2);
                    ctx.stroke();
                }
            });
        });
        ctx.restore();
    }

    // --- 5. Draw Broadcast CCTV HUD Overlays (Matching Reference Image) ---
    drawCCTVHud(ctx, width, height) {
        ctx.save();

        // 1. TOP-LEFT: ● REC CAM-04 (Blinking red dot)
        const isBlinkOn = Math.floor(performance.now() / 600) % 2 === 0;
        ctx.font = 'bold 12px "Geist Mono", "JetBrains Mono", monospace';

        // Red REC Dot
        ctx.fillStyle = isBlinkOn ? '#ff0033' : '#550011';
        ctx.beginPath();
        ctx.arc(20, 24, 4.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText('REC', 30, 28);
        ctx.fillStyle = '#a1a1a1';
        ctx.fillText(this.camId, 68, 28);

        // 2. TOP-RIGHT: Timecode 00:00:43:23
        const timecode = this.getTimecode();
        ctx.fillStyle = 'rgba(12, 12, 12, 0.75)';
        ctx.fillRect(width - 130, 14, 115, 22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.strokeRect(width - 130, 14, 115, 22);

        ctx.font = '11px "Geist Mono", "JetBrains Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(timecode, width - 122, 29);

        // 3. BOTTOM TELEMETRY STATUS BAR
        // TRACKING • 4 OVERLAYS | ● SIGNAL GREEN | infer 22.3 ms
        const barY = height - 26;

        // Bottom Left Pill: TRACKING • 4 OVERLAYS
        ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
        ctx.fillRect(14, barY - 14, 150, 22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(14, barY - 14, 150, 22);

        ctx.font = '10px "Geist Mono", "JetBrains Mono", monospace';
        ctx.fillStyle = '#e2e8f0';
        ctx.fillText('TRACKING  •  4 OVERLAYS', 22, barY + 1);

        // Signal Pill: ● SIGNAL GREEN / YELLOW / RED
        let sigColor = '#00ff88';
        let sigText = 'SIGNAL GREEN';
        if (this.threeTwin.currentSignalState === 'yellow') {
            sigColor = '#ffb700';
            sigText = 'SIGNAL YELLOW';
        } else if (this.threeTwin.currentSignalState === 'red') {
            sigColor = '#ff0033';
            sigText = 'SIGNAL RED';
        }

        ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
        ctx.fillRect(174, barY - 14, 110, 22);
        ctx.strokeRect(174, barY - 14, 110, 22);

        ctx.fillStyle = sigColor;
        ctx.beginPath();
        ctx.arc(186, barY - 3, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(sigText, 196, barY + 1);

        // Bottom Right Pill: infer 22.3 ms
        ctx.fillStyle = 'rgba(10, 12, 18, 0.88)';
        ctx.fillRect(width - 110, barY - 14, 96, 22);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.strokeRect(width - 110, barY - 14, 96, 22);

        ctx.fillStyle = '#a1a1a1';
        ctx.fillText(`infer  ${this.inferLatency} ms`, width - 102, barY + 1);

        ctx.restore();
    }
}

window.CCTVVisionOverlay = CCTVVisionOverlay;
