(function () {
const LADDER = {
'motor-seal-in': {
  sol: `BST XIC(Start_PB) NXB XIC(Motor_Run) BND XIO(Stop_PB) XIO(Overload_Trip) OTE(Motor_Run);`,
  how: ['The classic seal-in rung: Start in parallel with a contact of the motor\'s own output, so it holds itself on once started.', 'Stop and Overload are XIO contacts in series after the branch, so either one breaks the rung no matter what the branch is doing.']
},
'part-counter': {
  sol: `XIC(Reset_Count) MOV(0,Part_Count);\nXIC(Part_Sensor) ONS(Sensor_Prev) XIO(Reset_Count) ADD(Part_Count,1,Part_Count);`,
  how: ['ONS passes power for exactly one scan when the rung before it goes true. Its storage bit remembers last scan\'s state.', 'The ONS comes before the Reset contact, so its storage bit keeps tracking the sensor even while Reset is held. Otherwise, releasing Reset with a part in front of the eye would count it.', 'A CTU counter does the same job when you can use a COUNTER tag.']
},
'toggle': {
  sol: `XIC(Toggle_PB) ONS(PB_Prev) OTE(Toggle_Pulse);\nBST XIC(Toggle_Pulse) XIO(Light) NXB XIO(Toggle_Pulse) XIC(Light) BND OTE(Light);`,
  how: ['Rung 0 makes a one-scan pulse from the button.', 'Rung 1 is a flip-flop: Light = (pulse AND NOT Light) OR (NOT pulse AND Light). Both branches read Light before the OTE writes it, so it flips exactly once.', 'The tempting single rung, BST XIO(Light) OTL(Light) NXB XIC(Light) OTU(Light) BND, fails. The first branch latches Light, and the second branch then sees it on and unlatches it in the same scan.'],
  tags: [{ name: 'Toggle_Pulse', type: 'BOOL', dir: 'int', d: 'One-scan pulse (ladder)' }]
},
'analog-scaling': {
  sol: `BST LES(Raw_Counts,3600) NXB GRT(Raw_Counts,21000) BND OTE(Sensor_Fault);\nXIO(Sensor_Fault) CPT(Pressure_PSI,(Raw_Counts-4000)*150.0/16000.0);\nXIO(Sensor_Fault) LES(Pressure_PSI,0.0) MOV(0.0,Pressure_PSI);\nXIO(Sensor_Fault) GRT(Pressure_PSI,150.0) MOV(150.0,Pressure_PSI);`,
  how: ['Rung 0: two compares in parallel make an OR, giving the fault bit.', 'CPT evaluates a whole expression. The REAL literals keep the fraction.', 'Two clamp rungs follow, and all three math rungs are conditioned on no fault, so the value holds while the signal is bad.']
},
'debounce': {
  sol: `BST XIC(Raw_Input) XIO(Clean_Output) NXB XIO(Raw_Input) XIC(Clean_Output) BND TON(Deb_Tmr,300,0);\nXIC(Deb_Tmr.DN) BST XIC(Raw_Input) OTL(Clean_Output) NXB XIO(Raw_Input) OTU(Clean_Output) BND;`,
  how: ['The branch is an exclusive-OR built from contacts: true while input and output disagree. The TON times only then.', 'When DN, copy the input across: latch if it is on, unlatch if it is off. Next scan they agree, and the TON resets itself.']
},
'hi-alarm': {
  sol: `GRT(Temp_PV,Alarm_SP) TON(Alm_Tmr,2000,0);\nXIC(Alm_Tmr.DN) OTL(Hi_Alarm);\nXIO(Alm_Tmr.DN) CMP(Temp_PV < Alarm_SP - Deadband) OTU(Hi_Alarm);`,
  how: ['A GRT feeding a TON is the delay-on.', 'OTL sets the alarm when the timer is done. OTU clears it below the deadband. CMP is used because the limit is an expression, which GRT/LES can\'t take.', 'Between the two thresholds neither rung fires, so the latched alarm holds. That gap is the hysteresis.']
},
'traffic-light': {
  sol: `XIO(Enable) MOV(0,Step);\nXIC(Enable) EQU(Step,0) MOV(10,Step);\nEQU(Step,10) EQU(Step,Last_Step) XIC(Step_Tmr.DN) MOV(20,Step);\nEQU(Step,20) EQU(Step,Last_Step) XIC(Step_Tmr.DN) MOV(30,Step);\nEQU(Step,30) EQU(Step,Last_Step) XIC(Step_Tmr.DN) MOV(10,Step);\nEQU(Step,10) MOV(4000,Step_Tmr.PRE);\nEQU(Step,20) MOV(5000,Step_Tmr.PRE);\nEQU(Step,30) MOV(2000,Step_Tmr.PRE);\nNEQ(Step,0) EQU(Step,Last_Step) TON(Step_Tmr,4000,0);\nMOV(Step,Last_Step);\nEQU(Step,10) OTE(Red_Lamp);\nEQU(Step,20) OTE(Green_Lamp);\nEQU(Step,30) OTE(Yellow_Lamp);`,
  how: ['Each transition is its own rung: "in step N AND timer done → MOV the next step".', 'Rungs run top to bottom in one scan, so after 10 → 20 the next rung could see step 20 with DN still on and jump again. The EQU(Step,Last_Step) contact blocks a second move in the same scan.', 'The timer is disabled for one scan after every step change, which resets it. The lamps are simple EQU → OTE rungs.']
},
'lead-lag': {
  sol: `GEQ(Wet_Well_Level,70.0) OTL(Lead_Call);\nXIC(Lead_Call) LEQ(Wet_Well_Level,30.0) OTU(Lead_Call) OTE(Swap_Pulse);\nBST XIC(Swap_Pulse) XIO(Lead_Is_Pump2) NXB XIO(Swap_Pulse) XIC(Lead_Is_Pump2) BND OTE(Lead_Is_Pump2);\nGEQ(Wet_Well_Level,85.0) OTL(Lag_Call);\nLEQ(Wet_Well_Level,50.0) OTU(Lag_Call);\nBST XIO(Lead_Is_Pump2) XIC(Lead_Call) NXB XIC(Lead_Is_Pump2) XIC(Lag_Call) BND OTE(Pump1_Run);\nBST XIC(Lead_Is_Pump2) XIC(Lead_Call) NXB XIO(Lead_Is_Pump2) XIC(Lag_Call) BND OTE(Pump2_Run);`,
  how: ['OTL/OTU pairs make each hysteresis call.', 'The rung that unlatches the lead call also pulses Swap_Pulse for that one scan, and a flip-flop rung toggles the lead.', 'Each pump runs on (it is lead AND lead call) OR (it is lag AND lag call), two branches per pump.'],
  tags: [{ name: 'Swap_Pulse', type: 'BOOL', dir: 'int', d: 'One-scan pulse (ladder)' }]
},
'permissive-chain': {
  sol: `MOV(0,Not_Ready_Code);\nXIO(Downstream_Ready) MOV(3,Not_Ready_Code);\nXIO(EStop_OK) MOV(2,Not_Ready_Code);\nXIO(Guard_Closed) MOV(1,Not_Ready_Code);\nXIC(Run_Cmd) EQU(Not_Ready_Code,0) OTE(Conveyor_Run);`,
  how: ['Ladder has no ELSIF, so priority comes from rung order. The last rung to write wins.', 'So the rungs go from lowest priority (3) to highest (1). The guard check runs last and overrides the others.']
},
'falling-edge': {
  sol: `XIC(Door_Prev) XIO(Door_Closed) OTE(Opened_Pulse);\nXIC(Opened_Pulse) ADD(Open_Count,1,Open_Count);\nXIC(Door_Closed) OTE(Door_Prev);`,
  how: ['"Was closed AND is now open" is the falling edge, as an OTE so it lasts exactly one scan.', 'The last rung copies the door state into Door_Prev for next scan. OSF(Storage,Output) is the one-instruction version.']
},
'peak-hold': {
  sol: `BST XIC(Reset_Peaks) NXB XIO(Initialized) BND BST MOV(Value,Peak_Max) NXB MOV(Value,Peak_Min) NXB OTL(Initialized) BND;\nGRT(Value,Peak_Max) MOV(Value,Peak_Max);\nLES(Value,Peak_Min) MOV(Value,Peak_Min);`,
  how: ['Rung 0: on reset or the first scan, load both peaks and latch Initialized. Output branches let one rung drive several outputs.', 'Then a compare-and-move rung for each peak.']
},
'hoa-mode': {
  sol: `MOV(0,Mode);\nXIC(Sel_Auto) MOV(2,Mode);\nXIC(Sel_Hand) MOV(1,Mode);\nXIC(Sel_Hand) XIC(Sel_Auto) MOV(99,Mode);\nEQU(Mode,99) OTE(Switch_Fault);\nBST EQU(Mode,1) NXB EQU(Mode,2) XIC(Auto_Call) BND OTE(Pump_Run);`,
  how: ['Again, rung order sets priority: the fault rung comes last, so it overrides Hand and Auto.', 'The pump rung is a branch: Hand, OR (Auto AND call).']
},
'valve-mismatch': {
  sol: `SUB(Valve_Fbk,Valve_Cmd,Position_Error);\nCMP(ABS(Position_Error) <= 2.0) OTE(In_Tolerance);\nCMP(ABS(Position_Error) > 5.0) OTE(Mismatch);`,
  how: ['SUB computes the signed error.', 'CMP accepts an expression, so ABS can go inside it. Otherwise you would need an ABS instruction into a temp tag first.']
},
'off-delay-fan': {
  sol: `XIC(Heater_On) TOF(Fan_Tmr,30000,0);\nXIC(Fan_Tmr.DN) OTE(Fan_Run);`,
  how: ['TOF is the ladder off-delay: DN goes true with the rung and stays true for PRE ms after the rung goes false.', 'At power-up, before the heater has ever run, DN is false, so the fan stays off.']
},
'staggered-start': {
  sol: `BST XIC(Start_PB) NXB XIC(Seq_Active) BND XIO(Stop_PB) OTE(Seq_Active);\nXIC(Seq_Active) TON(Stagger_Tmr,4000,0);\nXIC(Seq_Active) OTE(Motor1);\nXIC(Seq_Active) GEQ(Stagger_Tmr.ACC,2000) OTE(Motor2);\nXIC(Stagger_Tmr.DN) OTE(Motor3);`,
  how: ['A seal-in rung latches the sequence.', 'One TON: Motor 2 compares its ACC against 2000, and Motor 3 uses DN. Stopping drops the TON rung, which resets ACC for a fresh start.']
},
'run-hours': {
  sol: `XIC(Reset_Counters) BST MOV(0,Run_Seconds) NXB MOV(0,Ms_Accum) NXB MOV(0,Starts) BND;\nXIO(Reset_Counters) XIC(Motor_Running) ADD(Ms_Accum,Scan_Time_ms,Ms_Accum);\nXIO(Reset_Counters) XIC(Motor_Running) BST CPT(Run_Seconds,Run_Seconds + Ms_Accum / 1000) NXB MOD(Ms_Accum,1000,Ms_Accum) BND;\nXIO(Reset_Counters) XIC(Motor_Running) XIO(Run_Prev) ADD(Starts,1,Starts);\nXIC(Motor_Running) OTE(Run_Prev);\nCPT(Run_Hours,Run_Seconds / 3600.0);`,
  how: ['Ladder has no WHILE loop, so the carry uses integer math: whole seconds = Ms_Accum / 1000 (DINT division truncates), and MOD keeps the remainder.', 'The branches run top to bottom, so the CPT reads Ms_Accum before the MOD changes it.']
},
'tank-batch': {
  sol: `XIC(Stop_PB) MOV(0,Step);\nEQU(Step,30) XIO(Level_Low) MOV(0,Step);\nEQU(Step,20) XIC(Mix_Tmr.DN) MOV(30,Step);\nEQU(Step,10) XIC(Level_High) MOV(20,Step);\nEQU(Step,0) XIC(Start_PB) XIO(Stop_PB) MOV(10,Step);\nEQU(Step,20) TON(Mix_Tmr,3000,0);\nEQU(Step,10) OTE(Inlet_Valve);\nEQU(Step,20) OTE(Mixer);\nEQU(Step,30) OTE(Outlet_Valve);`,
  how: ['The transition rungs are in reverse order (30, 20, 10, 0). A step that changes can then only be tested again on the next scan, so one scan never jumps two steps.', 'The mix timer runs only in step 20, so leaving the step resets it.']
},
'jam-detect': {
  sol: `XIC(Jam_Reset) OTU(Jam_Fault);\nXIC(Motor_Run_Cmd) XIO(Jam_Fault) OTE(Motor_Out);\nXIC(Shaft_Prox) ONS(Prox_Prev) OTE(Prox_Edge);\nXIC(Motor_Out) XIO(Prox_Edge) TON(Jam_Tmr,2000,0);\nXIC(Jam_Tmr.DN) BST OTL(Jam_Fault) NXB OTU(Motor_Out) BND;`,
  how: ['The ONS turns each prox pulse into a one-scan edge.', 'The jam TON runs while the motor is on, but each edge opens its rung for one scan, which resets ACC. Two seconds without an edge and DN latches the fault.', 'The last rung also drops Motor_Out in that same scan.'],
  tags: [{ name: 'Prox_Edge', type: 'BOOL', dir: 'int', d: 'One-scan edge (ladder)' }]
},
'lift-position': {
  sol: `SUB(Target_Pos,Actual_Pos,Pos_Error);\nCMP(ABS(Pos_Error) <= 0.5) OTE(In_Position);\nXIC(Enable) GRT(Pos_Error,0.5) OTE(Want_Up);\nXIC(Enable) LES(Pos_Error,-0.5) OTE(Want_Down);\nXIC(Want_Up) XIO(Upper_Limit) OTE(Move_Up);\nXIC(Want_Down) XIO(Lower_Limit) OTE(Move_Down);\nBST XIC(Move_Up) NXB XIC(Move_Down) BND CMP(ABS(Pos_Error) < 10.0) OTE(Slow_Speed);\nBST XIC(Want_Up) XIC(Upper_Limit) NXB XIC(Want_Down) XIC(Lower_Limit) BND OTE(Limit_Fault);`,
  how: ['Intent bits first (Want_Up/Want_Down), then interlocks: each move needs its own limit clear.', 'Slow speed is "either move AND close". The fault is "wants to move into an active limit".']
},
'totalizer': {
  sol: `LES(Flow_GPM,0.5) MOV(0.0,Flow_Clipped);\nGEQ(Flow_GPM,0.5) MOV(Flow_GPM,Flow_Clipped);\nXIC(Reset_Total) MOV(0.0,Total_Gal);\nXIO(Reset_Total) CPT(Total_Gal,Total_Gal + Flow_Clipped * Scan_Time_ms / 60000.0);`,
  how: ['Two complementary compares apply the cutoff.', 'CPT does the integration. The REAL literal 60000.0 keeps the small per-scan amount.']
},
'pump-dry-run': {
  sol: `XIC(Reset_PB) GEQ(Suction_PSI,8.0) OTU(Dry_Run_Trip);\nXIC(Run_Cmd) XIO(Dry_Run_Trip) LES(Suction_PSI,5.0) TON(Low_Tmr,3000,0);\nXIC(Low_Tmr.DN) BST OTL(Dry_Run_Trip) NXB ADD(Trip_Count,1,Trip_Count) BND;\nXIC(Run_Cmd) XIO(Dry_Run_Trip) OTE(Pump_Run);`,
  how: ['Rung 0 is the reset: Reset_PB AND suction at 8 psi or more unlatches the trip.', 'Rung 1: the TON only times while every series condition is true. Any break resets ACC, so a short dip starts over.', 'Rung 2 uses output branches to latch the trip and count it in the same scan. The trip contact in rung 1 then drops the timer, so DN lasts one scan and the ADD runs once.', 'Rung 3 is the starter output, written last so a trip stops the pump straight away.']
},
'parking-counter': {
  how: ['CTU and CTD can share one COUNTER tag. CTU counts up on its rung\'s false → true transition (storage bit .CU), and CTD counts down on its own (.CD).', 'The GRT in front of CTD ignores exits when the lot reads empty, so the count never goes negative.', 'DN is true while ACC ≥ PRE, which gives "lot full" for free. MOV copies ACC out for the display.']
},
'service-timer': {
  how: ['RTO is the retentive timer: it keeps ACC when its rung goes false, so the run time adds up across starts and stops.', 'Only RES clears an RTO. DN stays on after the spindle stops, until maintenance resets it.']
},
'alarm-ack': {
  sol: `XIC(Alarm_Cond) TON(Delay_Tmr,2000,0);\nXIC(Delay_Tmr.DN) OTE(Alarm_Active);\nXIC(Alarm_Active) ONS(Active_Prev) OTL(Unacked);\nXIC(Ack_PB) ONS(Ack_Prev) OTU(Unacked);\nXIC(Alarm_Active) XIC(Unacked) OTE(Horn);\nMOV(0,Alarm_State);\nXIO(Alarm_Active) XIC(Unacked) MOV(3,Alarm_State);\nXIC(Alarm_Active) XIO(Unacked) MOV(2,Alarm_State);\nXIC(Alarm_Active) XIC(Unacked) MOV(1,Alarm_State);`,
  how: ['Rungs 0–1: the TON is the 2 s delay-on, and its DN drives Alarm_Active.', 'Rungs 2–3: an ONS in front of OTL and another in front of OTU make an edge-triggered set/reset latch. Each ONS has its own storage bit.', 'The state rungs write a default of 0, then overwrite it. Each MOV rung checks both bits, so exactly one of them fires.']
},
'burner-lightoff': {
  sol: `XIC(Start_PB) ONS(Start_Prev) OTE(Start_Edge);\nEQU(Step,10) MOV(5000,Step_Tmr.PRE);\nNEQ(Step,10) MOV(3000,Step_Tmr.PRE);\nEQU(Step,Last_Step) BST EQU(Step,10) XIC(Air_Flow_OK) NXB EQU(Step,20) BND TON(Step_Tmr,5000,0);\nMOV(Step,Last_Step);\nEQU(Step,0) XIC(Start_Edge) XIO(Flame_Detected) MOV(10,Step);\nEQU(Step,10) EQU(Step,Last_Step) XIC(Flame_Detected) MOV(99,Step);\nEQU(Step,10) EQU(Step,Last_Step) XIC(Step_Tmr.DN) MOV(20,Step);\nEQU(Step,20) EQU(Step,Last_Step) XIO(Air_Flow_OK) MOV(99,Step);\nEQU(Step,20) EQU(Step,Last_Step) XIC(Step_Tmr.DN) XIC(Flame_Detected) MOV(30,Step);\nEQU(Step,20) EQU(Step,Last_Step) XIC(Step_Tmr.DN) XIO(Flame_Detected) MOV(99,Step);\nEQU(Step,30) EQU(Step,Last_Step) BST XIO(Flame_Detected) NXB XIO(Air_Flow_OK) BND MOV(99,Step);\nEQU(Step,99) EQU(Step,Last_Step) XIC(Reset_PB) XIO(Flame_Detected) MOV(0,Step);\nXIC(Stop_PB) NEQ(Step,99) MOV(0,Step);\nBST EQU(Step,10) NXB EQU(Step,20) NXB EQU(Step,30) NXB EQU(Step,99) BND OTE(Blower_On);\nEQU(Step,20) OTE(Igniter_On);\nBST EQU(Step,20) NXB EQU(Step,30) BND OTE(Pilot_Valve);\nEQU(Step,30) OTE(Main_Valve);\nEQU(Step,99) OTE(Lockout);`,
  how: ['The step timer rung is gated by EQU(Step,Last_Step), and Last_Step is copied on the next rung, so the TON is off for one scan after every step change. That resets it, as in the ST version.', 'Each transition is its own rung. Rungs run top to bottom in one scan, so every transition also checks EQU(Step,Last_Step): once one rung has moved the step, no later rung can move it again that scan. Fault rungs come before timer rungs so they win.', 'The Stop rung sits after all transitions with NEQ(Step,99), so it can never clear a lockout. The output rungs decode Step with parallel EQU branches.']
}
};

const NEW = [
{
  id: 'parking-counter', title: 'Parking lot counter (CTU / CTD)', diff: 'Easy', topics: ['Counters', 'Ladder'], langs: ['ld'],
  desc: `<p>A small lot holds 5 cars. <code>Entry_Eye</code> pulses when a car enters and <code>Exit_Eye</code> pulses when one leaves. Keep the count in the <code>Lot_Count</code> COUNTER, using CTU to count up and CTD to count down.</p>
<ul><li><code>Cars_Inside</code> shows the count.</li><li><code>Lot_Full</code> is on when 5 or more cars are inside.</li><li>Ignore exits when the lot reads empty, so the count never goes negative.</li><li><code>Reset_PB</code> zeroes the count.</li></ul>`,
  tags: [
    { name: 'Entry_Eye', type: 'BOOL', dir: 'in', d: 'Pulses per entering car' },
    { name: 'Exit_Eye', type: 'BOOL', dir: 'in', d: 'Pulses per leaving car' },
    { name: 'Reset_PB', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Cars_Inside', type: 'DINT', dir: 'out', d: '' },
    { name: 'Lot_Full', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Lot_Count', type: 'COUNTER', dir: 'int', d: 'CTU/CTD counter, preset 5' }],
  ldStarter: `XIC(Entry_Eye) CTU(Lot_Count,5,0);\n`,
  hints: ['CTU and CTD can use the same COUNTER tag. Each has its own storage bit (.CU and .CD), so they don\'t interfere.', 'Put GRT(Lot_Count.ACC,0) in front of the CTD.'],
  ld: `XIC(Entry_Eye) CTU(Lot_Count,5,0);\nXIC(Exit_Eye) GRT(Lot_Count.ACC,0) CTD(Lot_Count,5,0);\nXIC(Reset_PB) RES(Lot_Count);\nMOV(Lot_Count.ACC,Cars_Inside);\nXIC(Lot_Count.DN) OTE(Lot_Full);`,
  tests: (() => { const In = [[1, { Entry_Eye: true }], [1, { Entry_Eye: false }]], Out = [[1, { Exit_Eye: true }], [1, { Exit_Eye: false }]]; return [
    { name: 'Fill the lot', steps: [[1, {}], ...In, ...In, ...In, ...In, ...In, ...Out] },
    { name: 'Exit from empty lot, reset', steps: [...Out, ...In, ...In, [1, { Reset_PB: true }], [1, { Reset_PB: false }], ...Out, ...In] },
    { name: 'Long pulses', hidden: true, steps: [[5, { Entry_Eye: true }], [1, { Entry_Eye: false }], [4, { Entry_Eye: true }], [1, { Entry_Eye: false }], [6, { Exit_Eye: true }], [2, { Exit_Eye: false }]] }]; })()
},
{
  id: 'service-timer', title: 'Retentive service timer (RTO)', diff: 'Medium', topics: ['Timers', 'RTO', 'Ladder'], langs: ['ld'],
  desc: `<p>A spindle needs service after <b>10 s</b> of total run time. That's shortened for testing; in real life it would be hours. The run time must add up across starts and stops, so use the <code>Runtime_Tmr</code> TIMER with RTO.</p>
<ul><li><code>Runtime_ms</code> shows the accumulated run time.</li><li><code>Service_Due</code> turns on once it reaches 10 s and stays on, even after the spindle stops.</li><li><code>Service_Reset</code> clears it all.</li></ul><p class="note">Scan time is 500 ms.</p>`,
  tags: [
    { name: 'Spindle_On', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Service_Reset', type: 'BOOL', dir: 'in', d: '' },
    { name: 'Runtime_ms', type: 'DINT', dir: 'out', d: 'Accumulated ms' },
    { name: 'Service_Due', type: 'BOOL', dir: 'out', d: '' },
    { name: 'Runtime_Tmr', type: 'TIMER', dir: 'int', d: 'RTO timer' }],
  ldStarter: `XIC(Spindle_On) RTO(Runtime_Tmr,10000,0);\n`,
  hints: ['An RTO keeps ACC when its rung goes false. Only RES clears it.', 'MOV the timer\'s ACC into Runtime_ms, and use DN for the service flag.'],
  ld: `XIC(Spindle_On) RTO(Runtime_Tmr,10000,0);\nXIC(Service_Reset) RES(Runtime_Tmr);\nMOV(Runtime_Tmr.ACC,Runtime_ms);\nXIC(Runtime_Tmr.DN) OTE(Service_Due);`,
  tests: [
    { name: 'Three runs add up', dt: 500, steps: [[2, {}], [8, { Spindle_On: true }], [4, { Spindle_On: false }], [8, { Spindle_On: true }], [4, { Spindle_On: false }], [8, { Spindle_On: true }], [4, { Spindle_On: false }]] },
    { name: 'Reset after service', dt: 500, steps: [[25, { Spindle_On: true }], [2, { Spindle_On: false }], [1, { Service_Reset: true }], [1, { Service_Reset: false }], [6, { Spindle_On: true }]] },
    { name: 'Short bursts', hidden: true, dt: 500, steps: [[3, { Spindle_On: true }], [1, { Spindle_On: false }], [3, { Spindle_On: true }], [1, { Spindle_On: false }], [3, { Spindle_On: true }], [1, { Spindle_On: false }], [3, { Spindle_On: true }], [1, { Spindle_On: false }], [3, { Spindle_On: true }], [1, { Spindle_On: false }], [3, { Spindle_On: true }], [1, { Spindle_On: false }]] }]
}];

for (const p of PROBLEMS) {
  const L = LADDER[p.id];
  p.langs = p.langs || ['st'];
  if (L && L.sol) { p.ld = L.sol; p.ldHow = L.how; if (L.tags) p.ldTags = L.tags; if (!p.langs.includes('ld')) p.langs.push('ld'); }
}
for (const p of NEW) { p.ldHow = LADDER[p.id].how; p.starter = ''; p.solution = null; PROBLEMS.push(p); }
const rank = { Easy: 0, Medium: 1, Hard: 2 };
PROBLEMS.sort((a, b) => rank[a.diff] - rank[b.diff]);
})();
