(function () {
const A = s => s.split('').map(c => c === '1');
const pulse = (extra, on = 1, off = 4) => [[on, Object.assign({ Shaft_Prox: true }, extra || {})], [off, { Shaft_Prox: false }]];
const enc = det => [[1, { Encoder_Pulse: true, Reject_Detect: det }], [1, { Encoder_Pulse: false, Reject_Detect: false }]];
const MORE = [
// ---------------- EASY ----------------
{
  id: 'permissive-chain', title: 'Conveyor permissives and reason code', diff: 'Easy', topics: ['Boolean logic', 'IF/ELSIF'],
  desc: `<p>The conveyor may run only while every permissive is healthy. <code>Conveyor_Run</code> is <code>Run_Cmd</code> AND all permissives.</p>
<p>The HMI also needs to know <b>why</b> the conveyor is not ready. Set <code>Not_Ready_Code</code> to the first missing permissive, in this order: 1 = guard open, 2 = e-stop not OK, 3 = downstream not ready. Use 0 when all are healthy. <code>Run_Cmd</code> is not a permissive.</p>`,
  tags: [
    { name: 'Run_Cmd', type: 'BOOL', dir: 'in', d: 'Operator run request' },
    { name: 'Guard_Closed', type: 'BOOL', dir: 'in', d: 'Guard switch made' },
    { name: 'EStop_OK', type: 'BOOL', dir: 'in', d: 'Safety relay healthy' },
    { name: 'Downstream_Ready', type: 'BOOL', dir: 'in', d: 'Next machine ready' },
    { name: 'Conveyor_Run', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Not_Ready_Code', type: 'DINT', dir: 'out', d: '0, 1, 2 or 3' }],
  starter: `IF NOT Guard_Closed THEN\n  \nEND_IF;\n`,
  hints: ['An IF/ELSIF chain naturally reports the first failure only.', 'Then Conveyor_Run := Run_Cmd AND (Not_Ready_Code = 0);'],
  solution: `IF NOT Guard_Closed THEN\n  Not_Ready_Code := 1;\nELSIF NOT EStop_OK THEN\n  Not_Ready_Code := 2;\nELSIF NOT Downstream_Ready THEN\n  Not_Ready_Code := 3;\nELSE\n  Not_Ready_Code := 0;\nEND_IF;\n\nConveyor_Run := Run_Cmd AND Not_Ready_Code = 0;\n`,
  tests: [
    { name: 'All combinations of one missing', steps: [[1, { Run_Cmd: true, Guard_Closed: true, EStop_OK: true, Downstream_Ready: true }], [1, { Guard_Closed: false }], [1, { Guard_Closed: true, EStop_OK: false }], [1, { EStop_OK: true, Downstream_Ready: false }], [1, { Downstream_Ready: true, Run_Cmd: false }]] },
    { name: 'Several missing at once', hidden: true, steps: [[1, { Run_Cmd: true }], [1, { EStop_OK: true }], [1, { Downstream_Ready: true }], [1, { Guard_Closed: true, EStop_OK: false }], [1, { EStop_OK: true }]] }]
},
{
  id: 'tank-volume', title: 'Tank volume from level', diff: 'Easy', topics: ['REAL math', 'Clamping'],
  desc: `<p>A vertical cylindrical tank has inside diameter <code>Diameter_m</code> and straight-side height <code>Height_m</code>. A radar transmitter reads <code>Level_m</code>.</p>
<ul><li>Clamp the level to 0…<code>Height_m</code> first. Radar can read slightly negative or above the top.</li>
<li><code>Volume_L</code> = π × (D/2)² × level × 1000. Use π = 3.14159265.</li>
<li><code>Percent_Full</code> = level ÷ height × 100.</li></ul>`,
  tags: [
    { name: 'Level_m', type: 'REAL', dir: 'in', d: 'Measured level, m' },
    { name: 'Diameter_m', type: 'REAL', dir: 'in', d: '' },
    { name: 'Height_m', type: 'REAL', dir: 'in', d: '' },
    { name: 'Volume_L', type: 'REAL', dir: 'out', d: 'Litres' },
    { name: 'Percent_Full', type: 'REAL', dir: 'out', d: '0–100' },
    { name: 'Lvl', type: 'REAL', dir: 'int', d: 'Clamped level' }],
  starter: `Lvl := Level_m;\n`,
  hints: ['Copy the level into Lvl, then use IF/ELSIF to pull it back inside 0…Height_m. Logix ST has no LIMIT function.', 'Compute the radius as Diameter_m / 2.0, a REAL division.'],
  solution: `Lvl := Level_m;\nIF Lvl < 0.0 THEN\n  Lvl := 0.0;\nELSIF Lvl > Height_m THEN\n  Lvl := Height_m;\nEND_IF;\n\nVolume_L := 3.14159265 * (Diameter_m / 2.0) * (Diameter_m / 2.0) * Lvl * 1000.0;\nPercent_Full := Lvl / Height_m * 100.0;\n`,
  tests: [
    { name: '2 m × 3 m tank', steps: [[1, { Diameter_m: 2.0, Height_m: 3.0, Level_m: 1.5 }], [1, { Level_m: -0.1 }], [1, { Level_m: 3.4 }]] },
    { name: 'Small tank', hidden: true, steps: [[1, { Diameter_m: 1.2, Height_m: 2.5, Level_m: 0.75 }], [1, { Level_m: 2.5 }], [1, { Level_m: 0.01 }]] }]
},
{
  id: 'array-stats', title: 'Array total, average, count above', diff: 'Easy', topics: ['Arrays', 'FOR loops', 'REAL math'],
  desc: `<p>From the ten readings in <code>Data</code>, compute <code>Total</code> and <code>Average</code>. Then compute <code>Above_Avg</code>: how many readings are <b>strictly greater</b> than the average.</p>`,
  tags: [
    { name: 'Data', type: 'REAL', dim: 10, dir: 'in', d: 'ARRAY[0..9] OF REAL' },
    { name: 'Total', type: 'REAL', dir: 'out', d: '' },
    { name: 'Average', type: 'REAL', dir: 'out', d: '' },
    { name: 'Above_Avg', type: 'DINT', dir: 'out', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: 'Loop index' }],
  starter: `Total := 0.0;\n`,
  hints: ['You need the average before you can count, so use two loops.', 'Reset Total and Above_Avg every scan, or they keep growing.'],
  solution: `Total := 0.0;\nFOR i := 0 TO 9 DO\n  Total := Total + Data[i];\nEND_FOR;\nAverage := Total / 10.0;\n\nAbove_Avg := 0;\nFOR i := 0 TO 9 DO\n  IF Data[i] > Average THEN\n    Above_Avg := Above_Avg + 1;\n  END_IF;\nEND_FOR;\n`,
  tests: [
    { name: '1 to 10, run twice', steps: [[1, { Data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }], [1, {}]] },
    { name: 'Outlier', steps: [[1, { Data: [10, 10, 10, 10, 10, 10, 10, 10, 10, 100] }]] },
    { name: 'Negatives', hidden: true, steps: [[1, { Data: [-2.5, 4, 0, 7.5, -10, 3, 3, 3, 1, 1] }], [1, { Data: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5] }]] }]
},
{
  id: 'lane-selector', title: 'Round-robin lane selector', diff: 'Easy', topics: ['MOD', 'Arrays'],
  desc: `<p>Parts are sent to four lanes in turn: part 1 goes to lane 1, part 2 to lane 2, … part 5 back to lane 1. From <code>Part_ID</code>, set <code>Lane</code> (1–4) and turn on only the matching <code>Lane_Valve[Lane−1]</code>.</p>
<p>A <code>Part_ID</code> of 0 or less is invalid. Set <code>Lane := 0</code> and turn every valve off.</p>`,
  tags: [
    { name: 'Part_ID', type: 'DINT', dir: 'in', d: '' },
    { name: 'Lane', type: 'DINT', dir: 'out', d: '0–4' },
    { name: 'Lane_Valve', type: 'BOOL', dim: 4, dir: 'out', d: 'ARRAY[0..3] OF BOOL' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `FOR i := 0 TO 3 DO\n  Lane_Valve[i] := 0;\nEND_FOR;\n`,
  hints: ['(Part_ID − 1) MOD 4 gives 0…3. Add 1 to get the lane.', 'Clear all the valves first, then set just one of them.'],
  solution: `FOR i := 0 TO 3 DO\n  Lane_Valve[i] := 0;\nEND_FOR;\n\nIF Part_ID <= 0 THEN\n  Lane := 0;\nELSE\n  Lane := (Part_ID - 1) MOD 4 + 1;\n  Lane_Valve[Lane - 1] := 1;\nEND_IF;\n`,
  tests: [
    { name: 'First eight parts', steps: [1, 2, 3, 4, 5, 6, 7, 8].map(n => [1, { Part_ID: n }]) },
    { name: 'Invalid and huge IDs', hidden: true, steps: [[1, { Part_ID: 13 }], [1, { Part_ID: 0 }], [1, { Part_ID: -3 }], [1, { Part_ID: 2147483647 }]] }]
},
{
  id: 'falling-edge', title: 'Falling-edge one-shot', diff: 'Easy', topics: ['Edge detection'],
  desc: `<p><code>Door_Closed</code> is TRUE while a cabinet door is shut. Make <code>Opened_Pulse</code> TRUE for <b>exactly one scan</b> each time the door opens (TRUE→FALSE), and count the openings in <code>Open_Count</code>.</p>
<p>If the door is already open on the very first scan, that is not an opening.</p>`,
  tags: [
    { name: 'Door_Closed', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Opened_Pulse', type: 'BOOL', dir: 'out', d: 'One-scan pulse' },
    { name: 'Open_Count', type: 'DINT', dir: 'out', d: '' },
    { name: 'Door_Prev', type: 'BOOL', dir: 'int', d: 'Storage bit' }],
  starter: `Opened_Pulse := ;\n`,
  hints: ['A falling edge is "was TRUE last scan AND is FALSE now".', 'Assign the pulse every scan so it goes FALSE again on its own.'],
  solution: `Opened_Pulse := Door_Prev AND NOT Door_Closed;\nIF Opened_Pulse THEN\n  Open_Count := Open_Count + 1;\nEND_IF;\nDoor_Prev := Door_Closed;\n`,
  tests: [
    { name: 'Open, hold open, close, open', steps: [[2, { Door_Closed: true }], [1, { Door_Closed: false }], [2, {}], [1, { Door_Closed: true }], [1, { Door_Closed: false }], [1, {}]] },
    { name: 'Starts open', hidden: true, steps: [[1, { Door_Closed: false }], [1, {}], [1, { Door_Closed: true }], [3, { Door_Closed: false }]] }]
},
{
  id: 'peak-hold', title: 'Peak hold (min / max)', diff: 'Easy', topics: ['Comparison', 'First scan'],
  desc: `<p>Track the highest and lowest <code>Value</code> seen in <code>Peak_Max</code> and <code>Peak_Min</code>.</p>
<p>On the very first scan, and on any scan while <code>Reset_Peaks</code> is TRUE, set both peaks to the current <code>Value</code>.</p>`,
  tags: [
    { name: 'Value', type: 'REAL', dir: 'in', d: '' },
    { name: 'Reset_Peaks', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Peak_Max', type: 'REAL', dir: 'out', d: '' },
    { name: 'Peak_Min', type: 'REAL', dir: 'out', d: '' },
    { name: 'Initialized', type: 'BOOL', dir: 'int', d: 'FALSE until the first scan has run' }],
  starter: `IF Reset_Peaks OR NOT Initialized THEN\n  \nEND_IF;\n`,
  hints: ['Peak_Min starts at 0.0, so without first-scan seeding it never rises to a positive minimum.', 'Set Initialized := 1 the first time through.'],
  solution: `IF Reset_Peaks OR NOT Initialized THEN\n  Peak_Max := Value;\n  Peak_Min := Value;\n  Initialized := 1;\nELSE\n  IF Value > Peak_Max THEN Peak_Max := Value; END_IF;\n  IF Value < Peak_Min THEN Peak_Min := Value; END_IF;\nEND_IF;\n`,
  tests: [
    { name: 'Positive values with reset', steps: [[1, { Value: 10.0 }], [1, { Value: 15.0 }], [1, { Value: 7.0 }], [1, { Value: 12.0 }], [1, { Value: 9.0, Reset_Peaks: true }], [1, { Value: 20.0, Reset_Peaks: false }]] },
    { name: 'All negative', hidden: true, steps: [[1, { Value: -5.0 }], [1, { Value: -2.0 }], [1, { Value: -8.5 }], [1, { Value: -3.0 }]] }]
},
{
  id: 'hoa-mode', title: 'Hand-Off-Auto selector decode', diff: 'Easy', topics: ['Boolean logic', 'Fault handling'],
  desc: `<p>A three-position HOA switch has two contacts: <code>Sel_Hand</code> and <code>Sel_Auto</code>. Decode them into <code>Mode</code>: 0 = Off, 1 = Hand, 2 = Auto. If both contacts are made at once, the switch is broken. Set <code>Mode := 99</code> and <code>Switch_Fault</code>.</p>
<p><code>Pump_Run</code> runs in Hand, follows <code>Auto_Call</code> in Auto, and is off in Off or on a fault.</p>`,
  tags: [
    { name: 'Sel_Hand', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Sel_Auto', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Auto_Call', type: 'BOOL', dir: 'in', d: 'Level control demand' },
    { name: 'Mode', type: 'DINT', dir: 'out', d: '0, 1, 2 or 99' },
    { name: 'Switch_Fault', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Pump_Run', type: 'BOOL', dir: 'out', d: '' }],
  starter: `// decode Mode first, then drive the pump from Mode\n`,
  hints: ['Check "both made" first in the IF chain.', 'Pump_Run := (Mode = 1) OR (Mode = 2 AND Auto_Call);'],
  solution: `IF Sel_Hand AND Sel_Auto THEN\n  Mode := 99;\nELSIF Sel_Hand THEN\n  Mode := 1;\nELSIF Sel_Auto THEN\n  Mode := 2;\nELSE\n  Mode := 0;\nEND_IF;\n\nSwitch_Fault := Mode = 99;\nPump_Run := Mode = 1 OR (Mode = 2 AND Auto_Call);\n`,
  tests: [
    { name: 'Each position', steps: [[1, {}], [1, { Sel_Hand: true }], [1, { Sel_Hand: false, Sel_Auto: true }], [1, { Auto_Call: true }], [1, { Sel_Hand: true }]] },
    { name: 'Fault with call', hidden: true, steps: [[1, { Sel_Hand: true, Sel_Auto: true, Auto_Call: true }], [1, { Sel_Hand: false }], [1, { Sel_Auto: false }]] }]
},
{
  id: 'valve-mismatch', title: 'Valve position mismatch', diff: 'Easy', topics: ['ABS', 'Comparison'],
  desc: `<p>A control valve has a command <code>Valve_Cmd</code> and a position feedback <code>Valve_Fbk</code>, both in %. Set <code>Position_Error</code> = feedback − command.</p>
<p><code>In_Tolerance</code> is TRUE when the error magnitude is ≤ 2.0 %. <code>Mismatch</code> is TRUE when it is &gt; 5.0 %. Between the two, both stay FALSE.</p>`,
  tags: [
    { name: 'Valve_Cmd', type: 'REAL', dir: 'in', d: '%' },
    { name: 'Valve_Fbk', type: 'REAL', dir: 'in', d: '%' },
    { name: 'Position_Error', type: 'REAL', dir: 'out', d: 'Fbk − Cmd' },
    { name: 'In_Tolerance', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Mismatch', type: 'BOOL', dir: 'out', d: '' }],
  starter: `Position_Error := ;\n`,
  hints: ['ABS(Position_Error) handles both directions.', 'Watch ≤ versus &lt; at exactly 2.0 and 5.0.'],
  solution: `Position_Error := Valve_Fbk - Valve_Cmd;\nIn_Tolerance := ABS(Position_Error) <= 2.0;\nMismatch := ABS(Position_Error) > 5.0;\n`,
  tests: [
    { name: 'Boundaries', steps: [[1, { Valve_Cmd: 50.0, Valve_Fbk: 50.0 }], [1, { Valve_Fbk: 52.0 }], [1, { Valve_Fbk: 55.0 }], [1, { Valve_Fbk: 55.5 }]] },
    { name: 'Negative error', hidden: true, steps: [[1, { Valve_Cmd: 80.0, Valve_Fbk: 78.0 }], [1, { Valve_Fbk: 74.0 }], [1, { Valve_Fbk: 76.0 }]] }]
},
{
  id: 'linear-search', title: 'Search an array', diff: 'Easy', topics: ['Arrays', 'FOR loops'],
  desc: `<p>Find the first position of <code>Target</code> in <code>Data[0..19]</code> and put it in <code>Found_Index</code>, or −1 if it is not there. Count how many times it appears in <code>Occurrences</code>.</p>`,
  tags: [
    { name: 'Data', type: 'DINT', dim: 20, dir: 'in', d: 'ARRAY[0..19] OF DINT' },
    { name: 'Target', type: 'DINT', dir: 'in', d: '' },
    { name: 'Found_Index', type: 'DINT', dir: 'out', d: 'First index, or -1' },
    { name: 'Occurrences', type: 'DINT', dir: 'out', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `Found_Index := -1;\nOccurrences := 0;\n`,
  hints: ['Only record the index while Found_Index is still −1.', 'Don\'t EXIT early, because you still need the count.'],
  solution: `Found_Index := -1;\nOccurrences := 0;\nFOR i := 0 TO 19 DO\n  IF Data[i] = Target THEN\n    Occurrences := Occurrences + 1;\n    IF Found_Index = -1 THEN\n      Found_Index := i;\n    END_IF;\n  END_IF;\nEND_FOR;\n`,
  tests: [
    { name: 'Found twice', steps: [[1, { Data: [4, 8, 15, 16, 23, 42, 8, 1, 0, 0, 3, 3, 3, 9, 9, 7, 5, 5, 2, 6], Target: 8 }], [1, { Target: 99 }]] },
    { name: 'Edges', hidden: true, steps: [[1, { Data: [7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7], Target: 7 }], [1, { Target: 0 }], [1, { Data: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, -4], Target: -4 }]] }]
},
// ---------------- MEDIUM ----------------
{
  id: 'off-delay-fan', title: 'Cooling fan off-delay (TOFR)', diff: 'Medium', topics: ['Timers', 'TOFR'],
  desc: `<p>A heater needs its cooling fan to keep running after it switches off. <code>Fan_Run</code> is on whenever <code>Heater_On</code> is on, and for <b>30 s</b> after it goes off. If the heater comes back on during the cool-down, the fan simply keeps running.</p>
<p>At power-up with the heater off, the fan must be off. Scan time is 1 s.</p>`,
  tags: [
    { name: 'Heater_On', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Fan_Run', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Fan_Tmr', type: 'FBD_TIMER', dir: 'int', d: 'Use with TOFR (or TONR)' }],
  starter: `Fan_Tmr.PRE := 30000;\n`,
  hints: ['TOFR keeps DN TRUE while enabled and for PRE ms after the enable drops.', 'With TONR you would need a seal-in: Fan_Run := Heater_On OR (Fan_Run AND NOT Fan_Tmr.DN).'],
  solution: `Fan_Tmr.PRE := 30000;\nFan_Tmr.TimerEnable := Heater_On;\nTOFR(Fan_Tmr);\nFan_Run := Fan_Tmr.DN;\n`,
  tests: [
    { name: 'One heat cycle', dt: 1000, steps: [[3, {}], [5, { Heater_On: true }], [15, { Heater_On: false }], [20, {}]] },
    { name: 'Heater returns mid cool-down', hidden: true, dt: 1000, steps: [[5, { Heater_On: true }], [20, { Heater_On: false }], [3, { Heater_On: true }], [25, { Heater_On: false }], [10, {}]] }]
},
{
  id: 'staggered-start', title: 'Staggered motor start', diff: 'Medium', topics: ['Timers', 'Latching'],
  desc: `<p>Three large motors must not start together, because of inrush current. A momentary <code>Start_PB</code> starts the sequence. <code>Motor1</code> starts immediately, <code>Motor2</code> after 2 s, and <code>Motor3</code> after 4 s.</p>
<p><code>Stop_PB</code> stops all three at once and wins over Start. Starting again restarts the stagger from zero. Scan time is 250 ms.</p>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: 'Momentary' },
    { name: 'Stop_PB', type: 'BOOL', dir: 'in', d: 'Momentary' },
    { name: 'Motor1', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Motor2', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Motor3', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Seq_Active', type: 'BOOL', dir: 'int', d: 'Latched run' },
    { name: 'Stagger_Tmr', type: 'FBD_TIMER', dir: 'int', d: '' }],
  starter: `IF Stop_PB THEN\n  Seq_Active := 0;\nELSIF Start_PB THEN\n  Seq_Active := 1;\nEND_IF;\n`,
  hints: ['One timer with PRE 4000 is enough. Compare its ACC against 2000 for Motor2.', 'Disabling the timer when stopped clears ACC, so a restart is fresh.'],
  solution: `IF Stop_PB THEN\n  Seq_Active := 0;\nELSIF Start_PB THEN\n  Seq_Active := 1;\nEND_IF;\n\nStagger_Tmr.PRE := 4000;\nStagger_Tmr.TimerEnable := Seq_Active;\nTONR(Stagger_Tmr);\n\nMotor1 := Seq_Active;\nMotor2 := Seq_Active AND Stagger_Tmr.ACC >= 2000;\nMotor3 := Stagger_Tmr.DN;\n`,
  tests: [
    { name: 'Start and stop', dt: 250, steps: [[2, {}], [1, { Start_PB: true }], [3, { Start_PB: false }], [8, {}], [8, {}], [1, { Stop_PB: true }], [2, { Stop_PB: false }]] },
    { name: 'Restart resets the stagger', hidden: true, dt: 250, steps: [[1, { Start_PB: true }], [12, { Start_PB: false }], [1, { Stop_PB: true }], [1, { Stop_PB: false, Start_PB: true }], [4, { Start_PB: false }], [1, { Start_PB: true, Stop_PB: true }], [2, { Start_PB: false, Stop_PB: false }]] }]
},
{
  id: 'run-hours', title: 'Run-hours and start counter', diff: 'Medium', topics: ['Integer math', 'Edge detection', 'Precision'],
  desc: `<p>Maintenance wants motor run time and a start count. While <code>Motor_Running</code> is TRUE, add <code>Scan_Time_ms</code> to the run time. Report whole seconds in <code>Run_Seconds</code> and <code>Run_Hours</code> = seconds ÷ 3600.</p>
<p>Count each FALSE→TRUE of <code>Motor_Running</code> in <code>Starts</code>. <code>Reset_Counters</code> clears everything.</p>
<p class="note">Why not just add 0.25 s to a REAL each scan? After a few months a 32-bit REAL can no longer add tiny steps, and the counter silently stops. Accumulate milliseconds in a DINT and carry them into seconds.</p>`,
  tags: [
    { name: 'Motor_Running', type: 'BOOL', dir: 'in', d: 'Run feedback' },
    { name: 'Scan_Time_ms', type: 'DINT', dir: 'in', d: 'Task period' },
    { name: 'Reset_Counters', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Run_Seconds', type: 'DINT', dir: 'out', d: 'Whole seconds' },
    { name: 'Run_Hours', type: 'REAL', dir: 'out', d: '' },
    { name: 'Starts', type: 'DINT', dir: 'out', d: '' },
    { name: 'Ms_Accum', type: 'DINT', dir: 'int', d: 'Leftover milliseconds' },
    { name: 'Run_Prev', type: 'BOOL', dir: 'int', d: '' }],
  starter: `IF Reset_Counters THEN\n  \nELSIF Motor_Running THEN\n  \nEND_IF;\n`,
  hints: ['After adding to Ms_Accum, move every full 1000 ms into Run_Seconds. A WHILE loop handles scan times over 1 s.', 'Run_Hours := Run_Seconds / 3600.0; (the REAL literal matters)'],
  solution: `IF Reset_Counters THEN\n  Run_Seconds := 0;\n  Ms_Accum := 0;\n  Starts := 0;\nELSIF Motor_Running THEN\n  Ms_Accum := Ms_Accum + Scan_Time_ms;\n  WHILE Ms_Accum >= 1000 DO\n    Ms_Accum := Ms_Accum - 1000;\n    Run_Seconds := Run_Seconds + 1;\n  END_WHILE;\n  IF NOT Run_Prev THEN\n    Starts := Starts + 1;\n  END_IF;\nEND_IF;\nRun_Prev := Motor_Running;\nRun_Hours := Run_Seconds / 3600.0;\n`,
  tests: [
    { name: 'Two short runs', dt: 250, steps: [[2, { Scan_Time_ms: 250 }], [10, { Motor_Running: true }], [3, { Motor_Running: false }], [4, { Motor_Running: true }], [1, { Motor_Running: false }]] },
    { name: 'Long scans and reset', hidden: true, steps: [[90, { Scan_Time_ms: 60000, Motor_Running: true }], [1, { Motor_Running: false }], [1, { Reset_Counters: true }], [1, { Reset_Counters: false, Scan_Time_ms: 2500, Motor_Running: true }], [1, {}]] }]
},
{
  id: 'rotate-array', title: 'Rotate an array', diff: 'Medium', topics: ['Arrays', 'MOD'],
  desc: `<p>Copy <code>Data[0..9]</code> into <code>Rotated</code>, rotated left by <code>Shift</code> places: <code>Rotated[i] = Data[(i + Shift) wrapped to 0..9]</code>.</p>
<p><code>Shift</code> can be larger than 10 or negative, where −1 rotates right by one. Careful: in ST, MOD of a negative number is negative.</p>`,
  tags: [
    { name: 'Data', type: 'DINT', dim: 10, dir: 'in', d: 'ARRAY[0..9] OF DINT' },
    { name: 'Shift', type: 'DINT', dir: 'in', d: 'Any value' },
    { name: 'Rotated', type: 'DINT', dim: 10, dir: 'out', d: 'ARRAY[0..9] OF DINT' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' },
    { name: 'k', type: 'DINT', dir: 'int', d: 'Source index' }],
  starter: `FOR i := 0 TO 9 DO\n  \nEND_FOR;\n`,
  hints: ['−3 MOD 10 is −3, not 7.', '((i + Shift) MOD 10 + 10) MOD 10 is always 0…9.'],
  solution: `FOR i := 0 TO 9 DO\n  k := ((i + Shift) MOD 10 + 10) MOD 10;\n  Rotated[i] := Data[k];\nEND_FOR;\n`,
  tests: [
    { name: 'Left by 3', steps: [[1, { Data: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], Shift: 3 }], [1, { Shift: 0 }]] },
    { name: 'Negative and large', hidden: true, steps: [[1, { Data: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], Shift: -1 }], [1, { Shift: 23 }], [1, { Shift: -47 }]] }]
},
{
  id: 'bcd-convert', title: 'Integer to BCD for a display', diff: 'Medium', topics: ['Integer math', 'Bit packing'],
  desc: `<p>A 4-digit panel display wants BCD: each decimal digit goes in its own 4-bit nibble. For example, 1234 becomes <code>16#1234</code> (= 4660).</p>
<p>Convert <code>Value</code> (0–9999) into <code>BCD_Out</code>. If <code>Value</code> is out of range, output 0 and set <code>Range_Error</code>.</p>`,
  tags: [
    { name: 'Value', type: 'DINT', dir: 'in', d: '' },
    { name: 'BCD_Out', type: 'DINT', dir: 'out', d: 'Packed BCD' },
    { name: 'Range_Error', type: 'BOOL', dir: 'out', d: '' }],
  starter: `// thousands digit: Value / 1000\n// hundreds digit: (Value / 100) MOD 10\n`,
  hints: ['DINT division truncates, which is exactly what you want here.', 'Nibble weights are 4096, 256, 16 and 1.'],
  solution: `IF Value < 0 OR Value > 9999 THEN\n  BCD_Out := 0;\n  Range_Error := 1;\nELSE\n  Range_Error := 0;\n  BCD_Out := (Value / 1000) * 4096\n           + ((Value / 100) MOD 10) * 256\n           + ((Value / 10) MOD 10) * 16\n           + Value MOD 10;\nEND_IF;\n`,
  tests: [
    { name: 'Digits', steps: [0, 9, 10, 1234, 507].map(v => [1, { Value: v }]) },
    { name: 'Range', hidden: true, steps: [9999, 10000, -1, 8080].map(v => [1, { Value: v }]) }]
},
{
  id: 'checksum', title: 'Message checksum', diff: 'Medium', topics: ['Bitwise', 'Serial comms'],
  desc: `<p>An RS-232 device sends 8 data bytes in <code>Msg</code> (each 0–255), followed by a checksum <code>Rx_Check</code>. Compute both common checks:</p>
<ul><li><code>Xor_Check</code>: XOR of all 8 bytes</li><li><code>Sum_Check</code>: sum of all 8 bytes, MOD 256</li></ul>
<p>The device uses the sum. Set <code>Valid</code> when <code>Sum_Check = Rx_Check</code>.</p>`,
  tags: [
    { name: 'Msg', type: 'DINT', dim: 8, dir: 'in', d: 'ARRAY[0..7], bytes' },
    { name: 'Rx_Check', type: 'DINT', dir: 'in', d: 'Received checksum' },
    { name: 'Xor_Check', type: 'DINT', dir: 'out', d: '' },
    { name: 'Sum_Check', type: 'DINT', dir: 'out', d: '' },
    { name: 'Valid', type: 'BOOL', dir: 'out', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `Xor_Check := 0;\nSum_Check := 0;\n`,
  hints: ['XOR on two DINTs is bitwise in ST.', 'Take MOD 256 after the loop (or inside it, which gives the same result).'],
  solution: `Xor_Check := 0;\nSum_Check := 0;\nFOR i := 0 TO 7 DO\n  Xor_Check := Xor_Check XOR Msg[i];\n  Sum_Check := Sum_Check + Msg[i];\nEND_FOR;\nSum_Check := Sum_Check MOD 256;\nValid := Sum_Check = Rx_Check;\n`,
  tests: [
    { name: 'Good frame', steps: [[1, { Msg: [1, 2, 3, 4, 5, 6, 7, 8], Rx_Check: 36 }], [1, { Msg: [255, 255, 255, 255, 0, 0, 0, 1], Rx_Check: 253 }]] },
    { name: 'Corrupt frame, then fixed', hidden: true, steps: [[1, { Msg: [16, 32, 64, 128, 170, 85, 0, 255], Rx_Check: 0 }], [1, { Rx_Check: 238 }], [1, { Msg: [16, 32, 64, 128, 170, 85, 1, 255] }]] }]
},
{
  id: 'tank-batch', title: 'Fill-mix-drain sequence', diff: 'Medium', topics: ['CASE', 'State machines', 'Timers'],
  desc: `<p>Write a batch tank sequence with <code>Step</code>: 0 = idle, 10 = fill, 20 = mix, 30 = drain.</p>
<ul><li>Idle: <code>Start_PB</code> begins filling.</li>
<li>Fill: <code>Inlet_Valve</code> open until <code>Level_High</code>.</li>
<li>Mix: <code>Mixer</code> on for 3 s.</li>
<li>Drain: <code>Outlet_Valve</code> open until <code>Level_Low</code> goes FALSE (tank empty), then back to idle.</li></ul>
<p><code>Stop_PB</code> returns to idle with every output off, from any step. Scan time is 250 ms.</p>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Stop_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Level_High', type: 'BOOL', dir: 'in', d: 'TRUE = full' },
    { name: 'Level_Low', type: 'BOOL', dir: 'in', d: 'TRUE = liquid above low switch' },
    { name: 'Step', type: 'DINT', dir: 'out', d: '0, 10, 20, 30' },
    { name: 'Inlet_Valve', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Mixer', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Outlet_Valve', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Mix_Tmr', type: 'FBD_TIMER', dir: 'int', d: '' }],
  starter: `IF Stop_PB THEN\n  Step := 0;\nEND_IF;\n\nCASE Step OF\n  0:\n    \nEND_CASE;\n`,
  hints: ['Enable Mix_Tmr only while Step = 20. Leaving the step resets it automatically.', 'Drive outputs from Step after the CASE: Inlet_Valve := Step = 10; and so on.'],
  solution: `IF Stop_PB THEN\n  Step := 0;\nEND_IF;\n\nCASE Step OF\n  0:  IF Start_PB AND NOT Stop_PB THEN Step := 10; END_IF;\n  10: IF Level_High THEN Step := 20; END_IF;\n  20: IF Mix_Tmr.DN THEN Step := 30; END_IF;\n  30: IF NOT Level_Low THEN Step := 0; END_IF;\nEND_CASE;\n\nMix_Tmr.PRE := 3000;\nMix_Tmr.TimerEnable := Step = 20;\nTONR(Mix_Tmr);\n\nInlet_Valve := Step = 10;\nMixer := Step = 20;\nOutlet_Valve := Step = 30;\n`,
  tests: [
    { name: 'Full batch', dt: 250, steps: [[2, {}], [1, { Start_PB: true }], [3, { Start_PB: false }], [2, { Level_Low: true }], [2, { Level_High: true }], [5, {}], [12, {}], [2, { Level_High: false }], [3, { Level_Low: false }]] },
    { name: 'Stop during mix', hidden: true, dt: 250, steps: [[1, { Start_PB: true, Level_Low: true, Level_High: true }], [1, { Start_PB: false }], [4, {}], [1, { Stop_PB: true }], [4, { Stop_PB: false }], [1, { Start_PB: true }], [2, { Start_PB: false }]] }]
},
{
  id: 'voting-2oo3', title: '2-out-of-3 sensor voting', diff: 'Medium', topics: ['Safety logic', 'MIN/MAX'],
  desc: `<p>Three thermocouples measure the same zone. Report the <b>median</b> as <code>Voted_Temp</code>, so one failed sensor can't drag the reading.</p>
<p><code>Trip</code> when at least <b>two</b> sensors are above <code>Trip_SP</code>. Raise <code>Dev_Alarm</code> when any sensor differs from the median by more than 10.0 °C.</p>`,
  tags: [
    { name: 'Temp_A', type: 'REAL', dir: 'in', d: '°C' },
    { name: 'Temp_B', type: 'REAL', dir: 'in', d: '°C' },
    { name: 'Temp_C', type: 'REAL', dir: 'in', d: '°C' },
    { name: 'Trip_SP', type: 'REAL', dir: 'in', d: '°C' },
    { name: 'Voted_Temp', type: 'REAL', dir: 'out', d: 'Median' },
    { name: 'Trip', type: 'BOOL', dir: 'out', d: '2oo3' },
    { name: 'Dev_Alarm', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Votes', type: 'DINT', dir: 'int', d: '' },
    { name: 'Hi', type: 'REAL', dir: 'int', d: 'Higher of A and B' },
    { name: 'Lo', type: 'REAL', dir: 'int', d: 'Lower of A and B' }],
  starter: `Votes := 0;\n`,
  hints: ['Sort A and B into Hi and Lo. The median is then Hi if C is above Hi, Lo if C is below Lo, and C otherwise.', 'Count votes with three IFs, then Trip := Votes >= 2;'],
  solution: `// median of three\nIF Temp_A > Temp_B THEN\n  Hi := Temp_A; Lo := Temp_B;\nELSE\n  Hi := Temp_B; Lo := Temp_A;\nEND_IF;\nIF Temp_C > Hi THEN\n  Voted_Temp := Hi;\nELSIF Temp_C < Lo THEN\n  Voted_Temp := Lo;\nELSE\n  Voted_Temp := Temp_C;\nEND_IF;\n\nVotes := 0;\nIF Temp_A > Trip_SP THEN Votes := Votes + 1; END_IF;\nIF Temp_B > Trip_SP THEN Votes := Votes + 1; END_IF;\nIF Temp_C > Trip_SP THEN Votes := Votes + 1; END_IF;\nTrip := Votes >= 2;\n\nDev_Alarm := ABS(Temp_A - Voted_Temp) > 10.0\n          OR ABS(Temp_B - Voted_Temp) > 10.0\n          OR ABS(Temp_C - Voted_Temp) > 10.0;\n`,
  tests: [
    { name: 'One sensor fails high', steps: [[1, { Temp_A: 1500.0, Temp_B: 1502.0, Temp_C: 1499.0, Trip_SP: 1600.0 }], [1, { Temp_B: 1800.0 }], [1, { Temp_C: 1650.0 }]] },
    { name: 'Orderings', hidden: true, steps: [[1, { Temp_A: 30.0, Temp_B: 10.0, Temp_C: 20.0, Trip_SP: 15.0 }], [1, { Temp_A: 10.0, Temp_B: 30.0, Temp_C: 20.0 }], [1, { Temp_A: 20.0, Temp_B: 10.0, Temp_C: 30.0, Trip_SP: 25.0 }]] }]
},
{
  id: 'totalizer', title: 'Flow totalizer with low-flow cutoff', diff: 'Medium', topics: ['Integration', 'REAL math'],
  desc: `<p>Integrate <code>Flow_GPM</code> into <code>Total_Gal</code>. Each scan, add flow × <code>Scan_Time_ms</code> ÷ 60000.</p>
<p>A flowmeter drifts around zero, so any flow below 0.5 GPM (negative included) counts as 0. Show the flow you actually used in <code>Flow_Clipped</code>. <code>Reset_Total</code> zeroes the total.</p>`,
  tags: [
    { name: 'Flow_GPM', type: 'REAL', dir: 'in', d: 'Gallons per minute' },
    { name: 'Scan_Time_ms', type: 'DINT', dir: 'in', d: '' },
    { name: 'Reset_Total', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Flow_Clipped', type: 'REAL', dir: 'out', d: 'After cutoff' },
    { name: 'Total_Gal', type: 'REAL', dir: 'out', d: '' }],
  starter: `IF Flow_GPM < 0.5 THEN\n  \nEND_IF;\n`,
  hints: ['Apply the cutoff first, then integrate the clipped value.', 'Divide by 60000.0, a REAL, or the integer math rounds everything away.'],
  solution: `IF Flow_GPM < 0.5 THEN\n  Flow_Clipped := 0.0;\nELSE\n  Flow_Clipped := Flow_GPM;\nEND_IF;\n\nIF Reset_Total THEN\n  Total_Gal := 0.0;\nELSE\n  Total_Gal := Total_Gal + Flow_Clipped * Scan_Time_ms / 60000.0;\nEND_IF;\n`,
  tests: [
    { name: 'Steady flow then drift', steps: [[10, { Flow_GPM: 120.0, Scan_Time_ms: 500 }], [5, { Flow_GPM: 0.3 }], [4, { Flow_GPM: -2.0 }], [3, { Flow_GPM: 60.0 }]] },
    { name: 'Reset mid-run', hidden: true, steps: [[6, { Flow_GPM: 30.0, Scan_Time_ms: 1000 }], [1, { Reset_Total: true }], [4, { Reset_Total: false, Flow_GPM: 0.5 }]] }]
},
{
  id: 'rate-of-change', title: 'Rate-of-change alarm', diff: 'Medium', topics: ['REAL math', 'Alarms', 'First scan'],
  desc: `<p>Compute how fast <code>Temp_PV</code> is changing, in °C per minute: <code>Rate_C_per_min</code> = (PV − PV last scan) × 60000 ÷ <code>Scan_Time_ms</code>. On the first scan there is no previous value, so the rate is 0.</p>
<p>Set <code>Rate_Alarm</code> when the rate's magnitude exceeds <code>Max_Rate</code>, rising or falling.</p>`,
  tags: [
    { name: 'Temp_PV', type: 'REAL', dir: 'in', d: '°C' },
    { name: 'Scan_Time_ms', type: 'DINT', dir: 'in', d: '' },
    { name: 'Max_Rate', type: 'REAL', dir: 'in', d: '°C/min' },
    { name: 'Rate_C_per_min', type: 'REAL', dir: 'out', d: '' },
    { name: 'Rate_Alarm', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Prev_Temp', type: 'REAL', dir: 'int', d: '' },
    { name: 'Have_Prev', type: 'BOOL', dir: 'int', d: '' }],
  starter: `IF Have_Prev THEN\n  \nELSE\n  \nEND_IF;\nPrev_Temp := Temp_PV;\n`,
  hints: ['Without the first-scan guard, the first rate is computed against 0.0 and gives a huge spike.', 'ABS(Rate_C_per_min) > Max_Rate covers both directions.'],
  solution: `IF Have_Prev THEN\n  Rate_C_per_min := (Temp_PV - Prev_Temp) * 60000.0 / Scan_Time_ms;\nELSE\n  Rate_C_per_min := 0.0;\n  Have_Prev := 1;\nEND_IF;\nPrev_Temp := Temp_PV;\nRate_Alarm := ABS(Rate_C_per_min) > Max_Rate;\n`,
  tests: [
    { name: 'Heat-up', steps: [[1, { Temp_PV: 1000.0, Scan_Time_ms: 1000, Max_Rate: 40.0 }], [1, { Temp_PV: 1000.5 }], [1, { Temp_PV: 1001.0 }], [1, { Temp_PV: 1002.0 }], [1, { Temp_PV: 1002.0 }]] },
    { name: 'Fast drop', hidden: true, steps: [[1, { Temp_PV: 500.0, Scan_Time_ms: 500, Max_Rate: 50.0 }], [1, { Temp_PV: 499.0 }], [1, { Temp_PV: 498.5 }], [1, { Temp_PV: 498.0 }]] }]
},
{
  id: 'drum-sequencer', title: 'Drum sequencer', diff: 'Medium', topics: ['Arrays', 'Timers', 'Bit access'],
  desc: `<p>A drum table <code>Drum[0..5]</code> holds an output pattern for each step. While <code>Run</code> is TRUE, advance <code>Drum_Step</code> every <code>Step_Time_ms</code>, wrapping from 5 back to 0.</p>
<p>Output the current pattern in <code>Out_Word</code> and its bits 0–2 on <code>Valve_1</code>…<code>Valve_3</code>. When <code>Run</code> goes FALSE, hold the step. Resuming restarts that step's time. Scan time is 100 ms.</p>`,
  tags: [
    { name: 'Run', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Drum', type: 'DINT', dim: 6, dir: 'in', d: 'ARRAY[0..5] OF DINT' },
    { name: 'Step_Time_ms', type: 'DINT', dir: 'in', d: '' },
    { name: 'Drum_Step', type: 'DINT', dir: 'out', d: '0–5' },
    { name: 'Out_Word', type: 'DINT', dir: 'out', d: '' },
    { name: 'Valve_1', type: 'BOOL', dir: 'out', d: 'Bit 0' },
    { name: 'Valve_2', type: 'BOOL', dir: 'out', d: 'Bit 1' },
    { name: 'Valve_3', type: 'BOOL', dir: 'out', d: 'Bit 2' },
    { name: 'Step_Tmr', type: 'FBD_TIMER', dir: 'int', d: '' }],
  starter: `Step_Tmr.PRE := Step_Time_ms;\nStep_Tmr.TimerEnable := Run;\nTONR(Step_Tmr);\n`,
  hints: ['When DN, advance the step and pulse Step_Tmr.Reset to restart the timer.', 'Valve_1 := Out_Word.0; reads a single bit.'],
  solution: `Step_Tmr.PRE := Step_Time_ms;\nStep_Tmr.TimerEnable := Run;\nTONR(Step_Tmr);\n\nIF Step_Tmr.DN THEN\n  Drum_Step := (Drum_Step + 1) MOD 6;\n  Step_Tmr.Reset := 1;\n  TONR(Step_Tmr);\n  Step_Tmr.Reset := 0;\nEND_IF;\n\nOut_Word := Drum[Drum_Step];\nValve_1 := Out_Word.0;\nValve_2 := Out_Word.1;\nValve_3 := Out_Word.2;\n`,
  tests: [
    { name: 'Four steps', dt: 100, steps: [[2, { Drum: [1, 3, 2, 6, 4, 0], Step_Time_ms: 2000 }], [10, { Run: true }], [20, {}], [20, {}], [20, {}]] },
    { name: 'Pause and resume', hidden: true, dt: 100, steps: [[30, { Drum: [5, 2, 7, 0, 1, 4], Step_Time_ms: 2000, Run: true }], [10, { Run: false }], [10, { Run: true }], [20, {}], [20, {}]] }]
},
{
  id: 'lift-position', title: 'Furnace lift positioning', diff: 'Medium', topics: ['Motion', 'Interlocks', 'ABS'],
  desc: `<p>A furnace lift moves to <code>Target_Pos</code> using <code>Actual_Pos</code> feedback from the drive (mm).</p>
<ul><li><code>In_Position</code> when |target − actual| ≤ 0.5 mm.</li>
<li>When <code>Enable</code> is TRUE and the error is &gt; 0.5, run <code>Move_Up</code>. When it is &lt; −0.5, run <code>Move_Down</code>.</li>
<li><code>Slow_Speed</code> while moving within 10 mm of target.</li>
<li>An active <code>Upper_Limit</code> blocks up moves and an active <code>Lower_Limit</code> blocks down moves. Moving away from a limit is still allowed. Set <code>Limit_Fault</code> while a move is wanted into an active limit.</li></ul>`,
  tags: [
    { name: 'Enable', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Target_Pos', type: 'REAL', dir: 'in', d: 'mm' },
    { name: 'Actual_Pos', type: 'REAL', dir: 'in', d: 'mm' },
    { name: 'Upper_Limit', type: 'BOOL', dir: 'in', d: 'TRUE = on limit' },
    { name: 'Lower_Limit', type: 'BOOL', dir: 'in', d: 'TRUE = on limit' },
    { name: 'Move_Up', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Move_Down', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Slow_Speed', type: 'BOOL', dir: 'out', d: '' },
    { name: 'In_Position', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Limit_Fault', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Pos_Error', type: 'REAL', dir: 'int', d: '' },
    { name: 'Want_Up', type: 'BOOL', dir: 'int', d: '' },
    { name: 'Want_Down', type: 'BOOL', dir: 'int', d: '' }],
  starter: `Pos_Error := Target_Pos - Actual_Pos;\n`,
  hints: ['Work out "want up" and "want down" first, then apply the limits.', 'Limit_Fault := (Want_Up AND Upper_Limit) OR (Want_Down AND Lower_Limit);'],
  solution: `Pos_Error := Target_Pos - Actual_Pos;\nIn_Position := ABS(Pos_Error) <= 0.5;\n\nWant_Up := Enable AND Pos_Error > 0.5;\nWant_Down := Enable AND Pos_Error < -0.5;\n\nMove_Up := Want_Up AND NOT Upper_Limit;\nMove_Down := Want_Down AND NOT Lower_Limit;\nSlow_Speed := (Move_Up OR Move_Down) AND ABS(Pos_Error) < 10.0;\nLimit_Fault := (Want_Up AND Upper_Limit) OR (Want_Down AND Lower_Limit);\n`,
  tests: [
    { name: 'Move up and settle', steps: [[1, { Target_Pos: 500.0, Actual_Pos: 100.0 }], [1, { Enable: true }], [1, { Actual_Pos: 495.0 }], [1, { Actual_Pos: 499.6 }], [1, { Actual_Pos: 500.5 }], [1, { Actual_Pos: 503.0 }]] },
    { name: 'Limits', hidden: true, steps: [[1, { Enable: true, Target_Pos: 900.0, Actual_Pos: 850.0, Upper_Limit: true }], [1, { Target_Pos: 800.0 }], [1, { Upper_Limit: false, Lower_Limit: true }], [1, { Target_Pos: 849.8 }]] }]
},
// ---------------- HARD ----------------
{
  id: 'fifo-queue', title: 'FIFO queue (FFL / FFU)', diff: 'Hard', topics: ['Arrays', 'Edge detection', 'Data structures'],
  desc: `<p>Build a 5-slot first-in-first-out queue, the ST version of FFL/FFU. On a rising edge of <code>Load_PB</code>, add <code>Load_Value</code> to the back of the queue. Ignore the load if the queue is full.</p>
<p>On a rising edge of <code>Unload_PB</code>, remove the oldest value into <code>Unloaded_Value</code>. Ignore the unload if the queue is empty.</p>
<p>If both edges happen on the same scan, unload first. Keep <code>Count</code>, <code>Full</code> and <code>Empty</code> updated.</p>`,
  tags: [
    { name: 'Load_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Unload_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Load_Value', type: 'DINT', dir: 'in', d: '' },
    { name: 'Unloaded_Value', type: 'DINT', dir: 'out', d: 'Last value removed' },
    { name: 'Count', type: 'DINT', dir: 'out', d: '0–5' },
    { name: 'Full', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Empty', type: 'BOOL', dir: 'out', d: '', init: true },
    { name: 'Queue', type: 'DINT', dim: 5, dir: 'int', d: 'ARRAY[0..4] OF DINT' },
    { name: 'Load_Prev', type: 'BOOL', dir: 'int', d: '' },
    { name: 'Unload_Prev', type: 'BOOL', dir: 'int', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `// unload first\n\n// then load\n\nFull := Count = 5;\nEmpty := Count = 0;\n`,
  hints: ['FFU style: take Queue[0], then shift Queue[1..4] down by one.', 'A ring buffer with head and tail indexes works too. Only the outputs are checked.'],
  solution: `IF Unload_PB AND NOT Unload_Prev AND Count > 0 THEN\n  Unloaded_Value := Queue[0];\n  FOR i := 0 TO 3 DO\n    Queue[i] := Queue[i + 1];\n  END_FOR;\n  Count := Count - 1;\nEND_IF;\n\nIF Load_PB AND NOT Load_Prev AND Count < 5 THEN\n  Queue[Count] := Load_Value;\n  Count := Count + 1;\nEND_IF;\n\nLoad_Prev := Load_PB;\nUnload_Prev := Unload_PB;\nFull := Count = 5;\nEmpty := Count = 0;\n`,
  tests: (() => {
    const L = v => [[1, { Load_PB: true, Load_Value: v }], [1, { Load_PB: false }]], U = () => [[1, { Unload_PB: true }], [1, { Unload_PB: false }]];
    return [
      { name: 'Load three, unload one', steps: [...L(11), ...L(22), ...L(33), ...U()] },
      { name: 'Fill, overflow, drain, underflow', steps: [...L(1), ...L(2), ...L(3), ...L(4), ...L(5), ...L(6), ...U(), ...U(), ...U(), ...U(), ...U(), ...U()] },
      { name: 'Simultaneous edges', hidden: true, steps: [...L(7), ...L(8), [1, { Load_PB: true, Unload_PB: true, Load_Value: 9 }], [1, { Load_PB: false, Unload_PB: false }], [3, { Load_PB: true, Load_Value: 10 }], ...U(), ...U(), ...U()] }];
  })()
},
{
  id: 'jam-detect', title: 'Conveyor jam detection', diff: 'Hard', topics: ['Timers', 'Edge detection', 'Watchdog'],
  desc: `<p>A proximity switch <code>Shaft_Prox</code> pulses as the tail pulley turns. While the conveyor runs, every rising edge proves the belt is moving.</p>
<ul><li><code>Motor_Out</code> = <code>Motor_Run_Cmd</code> AND NOT <code>Jam_Fault</code>.</li>
<li>While <code>Motor_Out</code> is on, if <b>2 s</b> pass with no rising edge, latch <code>Jam_Fault</code>, which drops the motor. Each edge restarts the 2 s, and so does every motor start.</li>
<li><code>Jam_Reset</code> clears the fault.</li></ul>
<p>Scan time is 100 ms.</p>`,
  tags: [
    { name: 'Motor_Run_Cmd', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Shaft_Prox', type: 'BOOL', dir: 'in', d: 'Pulse per pulley turn' },
    { name: 'Jam_Reset', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Motor_Out', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Jam_Fault', type: 'BOOL', dir: 'out', d: 'Latched' },
    { name: 'Jam_Tmr', type: 'FBD_TIMER', dir: 'int', d: '' },
    { name: 'Prox_Prev', type: 'BOOL', dir: 'int', d: '' }],
  starter: `IF Jam_Reset THEN\n  Jam_Fault := 0;\nEND_IF;\nMotor_Out := Motor_Run_Cmd AND NOT Jam_Fault;\n`,
  hints: ['Enable the timer while the motor runs, but drop the enable for one scan on each prox edge. That resets ACC.', 'When the timer is done, latch the fault and also clear Motor_Out on that same scan.'],
  solution: `IF Jam_Reset THEN\n  Jam_Fault := 0;\nEND_IF;\nMotor_Out := Motor_Run_Cmd AND NOT Jam_Fault;\n\nJam_Tmr.PRE := 2000;\nJam_Tmr.TimerEnable := Motor_Out AND NOT (Shaft_Prox AND NOT Prox_Prev);\nTONR(Jam_Tmr);\nProx_Prev := Shaft_Prox;\n\nIF Jam_Tmr.DN THEN\n  Jam_Fault := 1;\n  Motor_Out := 0;\nEND_IF;\n`,
  tests: [
    { name: 'Running, then belt stops', dt: 100, steps: [[2, {}], ...pulse({ Motor_Run_Cmd: true }), ...pulse(), ...pulse(), ...pulse(), [15, {}], [15, {}]] },
    { name: 'Reset and restart', dt: 100, steps: [[25, { Motor_Run_Cmd: true }], [1, { Jam_Reset: true }], [1, { Jam_Reset: false }], ...pulse(null, 1, 9), ...pulse(null, 1, 9), ...pulse(null, 1, 9)] },
    { name: 'Slow but alive', hidden: true, dt: 100, steps: [[1, { Motor_Run_Cmd: true }], ...pulse(null, 2, 16), ...pulse(null, 2, 16), ...pulse(null, 2, 16), [1, { Motor_Run_Cmd: false }], [30, {}], [5, { Motor_Run_Cmd: true }]] }]
},
{
  id: 'pi-controller', title: 'PI controller with anti-windup', diff: 'Hard', topics: ['Control loops', 'REAL math', 'Bumpless transfer'],
  desc: `<p>Implement this PI algorithm exactly, every scan:</p>
<ul><li><code>Error := SP − PV</code></li>
<li><b>Auto</b>: Integral += Ki × Error × <code>Scan_Time_ms</code>/1000, then clamp Integral to 0…100. CV = Kp × Error + Integral, clamped to 0…100.</li>
<li><b>Manual</b>: CV = <code>Manual_CV</code> clamped to 0…100. Back-calculate Integral = CV − Kp × Error, clamped to 0…100, so that switching to Auto is bumpless.</li></ul>
<p>The integral clamp is the anti-windup. Without it, a long saturation leaves the loop stuck at 100 % long after the error reverses.</p>`,
  tags: [
    { name: 'PV', type: 'REAL', dir: 'in', d: '' },
    { name: 'SP', type: 'REAL', dir: 'in', d: '' },
    { name: 'Kp', type: 'REAL', dir: 'in', d: 'Gain, %/unit' },
    { name: 'Ki', type: 'REAL', dir: 'in', d: '%/unit/s' },
    { name: 'Scan_Time_ms', type: 'DINT', dir: 'in', d: '' },
    { name: 'Auto_Mode', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Manual_CV', type: 'REAL', dir: 'in', d: '%' },
    { name: 'CV', type: 'REAL', dir: 'out', d: '0–100 %' },
    { name: 'Error', type: 'REAL', dir: 'int', d: '' },
    { name: 'Integral', type: 'REAL', dir: 'int', d: '' }],
  starter: `Error := SP - PV;\nIF Auto_Mode THEN\n  \nELSE\n  \nEND_IF;\n`,
  hints: ['Each clamp is an IF/ELSIF pair: below 0.0 set 0.0, above 100.0 set 100.0. Logix ST has no LIMIT function.', 'Clamp Integral before using it to compute CV.'],
  solution: `Error := SP - PV;\nIF Auto_Mode THEN\n  Integral := Integral + Ki * Error * Scan_Time_ms / 1000.0;\n  IF Integral < 0.0 THEN Integral := 0.0; ELSIF Integral > 100.0 THEN Integral := 100.0; END_IF;\n  CV := Kp * Error + Integral;\nELSE\n  CV := Manual_CV;\nEND_IF;\nIF CV < 0.0 THEN CV := 0.0; ELSIF CV > 100.0 THEN CV := 100.0; END_IF;\n\nIF NOT Auto_Mode THEN\n  // back-calculate for bumpless transfer\n  Integral := CV - Kp * Error;\n  IF Integral < 0.0 THEN Integral := 0.0; ELSIF Integral > 100.0 THEN Integral := 100.0; END_IF;\nEND_IF;\n`,
  tests: [
    { name: 'Manual to auto, bumpless', steps: [[2, { PV: 95.0, SP: 100.0, Kp: 2.0, Ki: 0.5, Scan_Time_ms: 500, Manual_CV: 30.0 }], [1, { Auto_Mode: true }], [3, {}], [2, { PV: 100.0 }]] },
    { name: 'Windup recovery', steps: [[1, { PV: 0.0, SP: 50.0, Kp: 2.0, Ki: 0.5, Scan_Time_ms: 500, Auto_Mode: true }], [40, {}], [1, { SP: -10.0 }], [8, {}]] },
    { name: 'Manual clamp', hidden: true, steps: [[1, { PV: 40.0, SP: 50.0, Kp: 1.5, Ki: 1.0, Scan_Time_ms: 250, Manual_CV: 120.0 }], [1, { Manual_CV: -5.0 }], [1, { Manual_CV: 60.0 }], [4, { Auto_Mode: true }]] }]
},
{
  id: 'recipe-dosing', title: 'Recipe dosing on a scale', diff: 'Hard', topics: ['Arrays', 'Sequencing', 'Process'],
  desc: `<p>Four ingredients are dosed one after another into a hopper on a scale. <code>Scale_Weight</code> is the cumulative weight.</p>
<ul><li>On a rising edge of <code>Start_PB</code> while idle (<code>Active_Ingredient = −1</code>), clear <code>Batch_Done</code> and begin ingredient 0.</li>
<li>While dosing ingredient k, only <code>Valve[k]</code> is open. Close it once <code>Scale_Weight ≥ cumulative target − Preact</code>, where the cumulative target is <code>Recipe_SP[0] + … + Recipe_SP[k]</code>, then move on to k+1.</li>
<li>After ingredient 3, return to idle (−1) and set <code>Batch_Done</code>. Start presses during a batch are ignored.</li></ul>`,
  tags: [
    { name: 'Start_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Scale_Weight', type: 'REAL', dir: 'in', d: 'kg, cumulative' },
    { name: 'Recipe_SP', type: 'REAL', dim: 4, dir: 'in', d: 'kg per ingredient' },
    { name: 'Preact', type: 'REAL', dir: 'in', d: 'kg still in flight when valve closes' },
    { name: 'Valve', type: 'BOOL', dim: 4, dir: 'out', d: 'ARRAY[0..3] OF BOOL' },
    { name: 'Active_Ingredient', type: 'DINT', dir: 'out', d: '-1 idle, 0..3 dosing', init: -1 },
    { name: 'Batch_Done', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Target', type: 'REAL', dir: 'int', d: 'Cumulative target' },
    { name: 'Start_Prev', type: 'BOOL', dir: 'int', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `IF Active_Ingredient = -1 THEN\n  \nELSIF Scale_Weight >= Target - Preact THEN\n  \nEND_IF;\nStart_Prev := Start_PB;\n`,
  hints: ['Keep a running cumulative Target and add Recipe_SP[k] each time you advance.', 'Drive the valves at the end: Valve[i] := (i = Active_Ingredient);'],
  solution: `IF Active_Ingredient = -1 THEN\n  IF Start_PB AND NOT Start_Prev THEN\n    Active_Ingredient := 0;\n    Target := Recipe_SP[0];\n    Batch_Done := 0;\n  END_IF;\nELSIF Scale_Weight >= Target - Preact THEN\n  Active_Ingredient := Active_Ingredient + 1;\n  IF Active_Ingredient > 3 THEN\n    Active_Ingredient := -1;\n    Batch_Done := 1;\n  ELSE\n    Target := Target + Recipe_SP[Active_Ingredient];\n  END_IF;\nEND_IF;\nStart_Prev := Start_PB;\n\nFOR i := 0 TO 3 DO\n  Valve[i] := i = Active_Ingredient;\nEND_FOR;\n`,
  tests: [
    { name: 'Full batch', steps: [[1, { Recipe_SP: [10, 5, 20, 2.5], Preact: 0.5, Scale_Weight: 0.0 }], [1, { Start_PB: true }], [1, { Start_PB: false, Scale_Weight: 4.0 }], [1, { Scale_Weight: 9.4 }], [1, { Scale_Weight: 9.5 }], [1, { Scale_Weight: 12.0 }], [1, { Scale_Weight: 14.6 }], [1, { Scale_Weight: 20.0 }], [1, { Scale_Weight: 34.5 }], [1, { Scale_Weight: 36.9 }], [1, { Scale_Weight: 37.0 }], [2, {}]] },
    { name: 'Start held and re-pressed', hidden: true, steps: [[1, { Recipe_SP: [1, 1, 1, 1], Preact: 0.0, Scale_Weight: 0.0, Start_PB: true }], [3, {}], [1, { Start_PB: false }], [1, { Start_PB: true, Scale_Weight: 1.0 }], [1, { Scale_Weight: 2.0 }], [1, { Scale_Weight: 3.0 }], [1, { Scale_Weight: 4.0 }], [1, { Start_PB: false }], [1, { Start_PB: true, Scale_Weight: 0.0 }]] }]
},
{
  id: 'shift-register', title: 'Reject tracking shift register', diff: 'Hard', topics: ['Arrays', 'Edge detection', 'Tracking'],
  desc: `<p>A vision camera inspects products at station 0. The reject gate is <b>8 pitches</b> downstream. <code>Encoder_Pulse</code> pulses once per product pitch.</p>
<ul><li>On each rising edge of <code>Encoder_Pulse</code>, shift <code>Track[0..11]</code> one place downstream (Track[11] falls off). Then store <code>Reject_Detect</code> in <code>Track[0]</code>.</li>
<li><code>Reject_Gate</code> = <code>Track[8]</code>.</li>
<li>Count, in <code>Reject_Count</code>, each shift that moves a TRUE into position 8.</li></ul>
<p class="note">This is the BSL instruction written by hand. Shift in the right direction, or one reject smears down the whole array.</p>`,
  tags: [
    { name: 'Encoder_Pulse', type: 'BOOL', dir: 'in', d: 'One per pitch' },
    { name: 'Reject_Detect', type: 'BOOL', dir: 'in', d: 'Camera result' },
    { name: 'Reject_Gate', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Reject_Count', type: 'DINT', dir: 'out', d: '' },
    { name: 'Track', type: 'BOOL', dim: 12, dir: 'int', d: 'ARRAY[0..11] OF BOOL' },
    { name: 'Enc_Prev', type: 'BOOL', dir: 'int', d: '' },
    { name: 'i', type: 'DINT', dir: 'int', d: '' }],
  starter: `IF Encoder_Pulse AND NOT Enc_Prev THEN\n  \nEND_IF;\nEnc_Prev := Encoder_Pulse;\nReject_Gate := Track[8];\n`,
  hints: ['FOR i := 11 TO 1 BY -1 DO Track[i] := Track[i - 1]; END_FOR;', 'Looping upward copies Track[0] into every slot. Try it and watch the trace.'],
  solution: `IF Encoder_Pulse AND NOT Enc_Prev THEN\n  FOR i := 11 TO 1 BY -1 DO\n    Track[i] := Track[i - 1];\n  END_FOR;\n  Track[0] := Reject_Detect;\n  IF Track[8] THEN\n    Reject_Count := Reject_Count + 1;\n  END_IF;\nEND_IF;\nEnc_Prev := Encoder_Pulse;\nReject_Gate := Track[8];\n`,
  tests: [
    { name: 'One reject travels to the gate', steps: [...enc(true), ...[1, 2, 3, 4, 5, 6, 7, 8, 9].flatMap(() => enc(false))] },
    { name: 'Back-to-back rejects', hidden: true, steps: [...enc(false), ...enc(true), ...enc(true), ...enc(false), ...enc(true), ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(() => enc(false)), [3, { Encoder_Pulse: true }]] }]
}];
PROBLEMS.push(...MORE);
const rank = { Easy: 0, Medium: 1, Hard: 2 };
PROBLEMS.sort((a, b) => rank[a.diff] - rank[b.diff]);
})();
