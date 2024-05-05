import React, { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { Box, Button, Select, Tooltip, Typography } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import useSound from "use-sound";
import { createTheme, styled, ThemeProvider } from "@mui/material/styles";
import ForwardIcon from "@mui/icons-material/Forward";
import {
	AccessTimeOutlined,
	EmojiEvents,
	TimelineOutlined,
	VisibilityOffOutlined,
	VisibilityOutlined,
	VolumeOff,
} from "@mui/icons-material";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";

const EASY: Policy = {
	length: 4,
	time: 6000,
	label: "Easy",
};

const HARD: Policy = {
	length: 10,
	time: 6000,
	label: "Hard",
};

const MEDIUM: Policy = {
	length: 8,
	time: 6000,
	label: "Medium",
};

const DIFFICULTIES = [EASY, MEDIUM, HARD];

type Difficulty = (typeof DIFFICULTIES)[number];

const AppContainer = styled(Box)({
	backgroundColor: "black",
	height: "100vh",
	display: "flex",
	flexDirection: "column",
	justifyContent: "space-between",
});

type Policy = {
	length: number;
	time: number;
	label: string;
};

const ERROR_FLASHING_TIME = 500;

enum StateIndication {
	Normal = "normal",
	Success = "success",
	Error = "error",
}

enum Direction {
	up = "up",
	down = "down",
	left = "left",
	right = "right",
}

function useHighscoreState(difficulty: string, sightread: boolean) {
	const [highscore, setHighscore] = useState<number | null>(null);
	const key = `${difficulty}-${MAX_TIMES_TO_CONSIDER}${sightread ? "-sightread" : ""}`;

	const updateHighscore = useCallback(
		(newV: number | null) => {
			setHighscore(newV);
			if (newV) {
				localStorage.setItem(key, newV.toString());
			}
		},
		[key, setHighscore]
	);

	useEffect(() => {
		const existingHighscore = parseFloat(localStorage.getItem(key) ?? "99999999999");
		updateHighscore(existingHighscore < 1000 ? existingHighscore : null);
	}, [difficulty, key, updateHighscore]);

	const proposeHighscore = useCallback(
		(times: number[]) => {
			if (times.length !== MAX_TIMES_TO_CONSIDER) {
				return;
			}
			const currTime = times.reduce((p, c) => p + c, 0) / MAX_TIMES_TO_CONSIDER / 1000;
			if (!highscore || currTime < highscore) {
				updateHighscore(currTime);
			}
		},
		[updateHighscore, highscore]
	);
	return { highscore, proposeHighscore };
}

const MAX_TIMES_TO_CONSIDER = 5;

function useTimerState(difficulty: string, sightread: boolean) {
	const [previousTime, setPreviousTime] = useState<number>(0);
	const [startTime, setStartTime] = useState(new Date());
	const [times, setTimes] = useState<number[]>([]);
	const { highscore, proposeHighscore } = useHighscoreState(difficulty, sightread);
	const finish = useCallback(
		(success: boolean) => {
			const now = new Date();
			const time = now.getTime() - startTime.getTime();
			if (success) {
				setTimes(times.length === MAX_TIMES_TO_CONSIDER ? [...times.slice(1), time] : [...times, time]);
				setPreviousTime(time);
				proposeHighscore(times);
			}
		},
		[startTime, setPreviousTime, times, proposeHighscore]
	);

	const beginTimer = useCallback(() => {
		setStartTime(new Date());
	}, [setStartTime]);

	const clearStats = useCallback(() => {
		setPreviousTime(0);
		setStartTime(new Date());
		setTimes([]);
	}, [setPreviousTime, setStartTime, setTimes]);
	return { previousTime, times, finish, clearStats, beginTimer, highscore };
}

const darkTheme = createTheme({
	palette: {
		mode: "dark",
	},
});

function App() {
	const [combo, setCombo] = useState([Direction.up, Direction.right, Direction.down, Direction.right]);
	const [progress, setProgress] = useState(0);
	const [policy, setPolicy] = useState<Difficulty>(EASY);
	const [stateIndication, setStateIndication] = useState<StateIndication>(StateIndication.Normal);
	const [mute, setMute] = useState(false);
	const [sightreadMode, setSightreadMode] = useState(false);
	const { previousTime, finish, times, clearStats, beginTimer, highscore } = useTimerState(policy.label, sightreadMode);
	const policyRef = useRef(policy);
	const [click] = useSound("/divers/click.mp3", { volume: mute ? 0.00000001 : 1 });
	const [failureSound] = useSound("/divers/failure.mp3", { volume: mute ? 0.0000001 : 1 });
	const [successSound] = useSound("/divers/success.mp3", { volume: mute ? 0.000001 : 1 });

	useEffect(() => {
		if (progress === 1) {
			beginTimer();
		}
	}, [progress, beginTimer]);
	useEffect(() => {
		policyRef.current = policy;
	}, [policyRef, policy]);
	const reset = useCallback(() => {
		setCombo(generateSequence(policyRef.current));
		setProgress(0);
		setStateIndication(StateIndication.Normal);
	}, [setCombo, setProgress, policyRef]);

	useEffect(() => {
		reset();
		clearStats();
	}, [reset, policy, clearStats, sightreadMode]);

	const initiateError = useCallback(() => {
		setStateIndication(StateIndication.Error);
		failureSound();
		finish(false);
		setTimeout(() => {
			reset();
		}, ERROR_FLASHING_TIME);
	}, [setStateIndication, reset, failureSound, finish]);

	const success = useCallback(() => {
		setStateIndication(StateIndication.Success);
		successSound();
		finish(true);
		setTimeout(() => {
			reset();
		}, ERROR_FLASHING_TIME);
	}, [setStateIndication, reset, successSound, finish]);

	const onKeyDown = useCallback(
		(key: Direction) => {
			if (stateIndication !== StateIndication.Normal) {
				return;
			}
			const nextNeeded = combo[progress];
			click();
			if (key !== nextNeeded) {
				initiateError();
				return;
			}
			const newProgress = progress + 1;
			if (newProgress === combo.length) {
				success();
				return;
			} else {
				setProgress(newProgress);
				return;
			}
		},
		[combo, progress, success, setProgress, click, initiateError, stateIndication]
	);

	useEffect(() => {
		const handler = ({ key }: { key: string }) => {
			const direction = identifyDirection(key);
			if (!direction) {
				return;
			}
			onKeyDown(direction);
		};
		window.addEventListener("keydown", handler, true);
		return () => window.removeEventListener("keydown", handler, true);
	}, [onKeyDown]);
	return (
		<ThemeProvider theme={darkTheme}>
			<AppContainer>
				<TerminalScreen
					currCombo={combo}
					progress={progress}
					gameState={stateIndication}
					sightreadMode={sightreadMode}
				/>
				<Box marginBottom="100px">
					<Scores previousTime={previousTime} times={times} highscore={highscore} />
					<DifficultyControls
						policy={policy}
						setPolicy={setPolicy}
						mute={mute}
						setMute={setMute}
						sightread={sightreadMode}
						setSightreadMode={setSightreadMode}
					/>
				</Box>
			</AppContainer>
		</ThemeProvider>
	);
}

const keys: Record<string, Direction> = {
	w: Direction.up,
	a: Direction.left,
	s: Direction.down,
	d: Direction.right,
	arrowright: Direction.right,
	arrowleft: Direction.left,
	arrowup: Direction.up,
	arrowdown: Direction.down,
};

function identifyDirection(key: string): Direction | undefined {
	return keys[key.toLowerCase()];
}

function generateSequence(policy: Policy) {
	const result = [];
	for (let i = 0; i < policy.length; i++) {
		result.push(DirectionsObj[Math.floor(Math.random() * DirectionsObj.length)]);
	}
	return result;
}

const DirectionsObj = Object.values(Direction);

type Combo = Direction[];

function TerminalScreen(props: {
	currCombo: Combo;
	progress: number;
	gameState: StateIndication;
	sightreadMode: boolean;
}) {
	const { currCombo, progress, gameState, sightreadMode } = props;

	return (
		<Box display="flex" justifyContent="center" marginTop="20vh" maxWidth="100%">
			{currCombo.map((ele, index) => {
				const status = calculcateArrowStatus(gameState, progress, index, sightreadMode);
				return <ArrowDisplay key={index} type={ele} version={status} />;
			})}
		</Box>
	);
}

function calculcateArrowStatus(
	gameState: StateIndication,
	progress: number,
	index: number,
	sightreadMode: boolean
): ArrowState {
	if (gameState === StateIndication.Error) {
		return "error";
	}
	if (gameState === StateIndication.Success) {
		return "success";
	}
	if (gameState !== StateIndication.Normal) {
		return "error"; // wtf???
	}
	if (progress > index) {
		return "completed";
	}
	if (progress === 0 && sightreadMode && index > 0) {
		return "invisible";
	}
	return "pending";
}

type ArrowState = "error" | "success" | "completed" | "pending" | "invisible";

const ArrowProps = {
	fontSize: "200px",
};

const Up = styled(ForwardIcon)({
	transform: "rotate(-90deg)",
	...ArrowProps,
});

const Left = styled(ForwardIcon)({
	transform: "rotate(-180deg)",
	...ArrowProps,
});

const Down = styled(ForwardIcon)({
	transform: "rotate(90deg)",
	...ArrowProps,
});

const Right = styled(ForwardIcon)({
	...ArrowProps,
});

function ArrowDisplay(props: { type: Direction; version: ArrowState }) {
	const { type, version } = props;
	const className = calculateClassName(version);
	if (type === Direction.up) {
		return <Up className={className} />;
	}

	if (type === Direction.down) {
		return <Down className={className} />;
	}
	if (type === Direction.right) {
		return <Right className={className} />;
	}
	if (type === Direction.left) {
		return <Left className={className} />;
	}
	return <>Unknown direction: {type}</>;
}

function calculateClassName(version: ArrowState) {
	if (version === "success") {
		return "baseArrow pulsingSuccess";
	}
	if (version === "error") {
		return "baseArrow pulsingFailure";
	}

	if (version === "completed") {
		return "baseArrow completedArrow";
	}

	if (version === "invisible") {
		return "baseArrow invisible";
	}

	return "baseArrow normalArrow";
}

const PLACEHOLDER_WIDTH = "80px";

function Scores(props: { previousTime: number; times: number[]; highscore: number | null }) {
	const { previousTime, times, highscore } = props;
	const timeSum = times.reduce((prev, curr) => prev + curr, 0);

	return (
		<Box display="flex" justifyContent="center" marginBottom="30px">
			<Tooltip title="Previous Time.  Timer starts after first keypress">
				<Typography
					sx={{
						color: "white",
						display: "flex",
						alignItems: "center",
						marginRight: "15px",
						minWidth: PLACEHOLDER_WIDTH,
					}}
				>
					<AccessTimeOutlined sx={{ marginRight: "4px" }} />
					{previousTime ? `${(previousTime / 1000).toFixed(3)}s` : ""}
				</Typography>
			</Tooltip>
			<Tooltip title={"Average time over last " + times.length + " succesful games"}>
				<Typography
					sx={{
						color: "white",
						display: "flex",
						alignItems: "center",
						marginRight: "15px",
						minWidth: PLACEHOLDER_WIDTH,
					}}
				>
					<TimelineOutlined sx={{ marginRight: "4px" }} />{" "}
					{times.length ? `${(timeSum / 1000 / times.length).toFixed(3)}s` : ""}
				</Typography>
			</Tooltip>

			<Tooltip title={"Best average over " + MAX_TIMES_TO_CONSIDER}>
				<Typography
					sx={{
						color: "white",
						display: "flex",
						alignItems: "center",
						marginRight: "15px",
						minWidth: PLACEHOLDER_WIDTH,
					}}
				>
					<EmojiEvents sx={{ marginRight: "4px" }} /> {highscore ? `${highscore.toFixed(3)}s` : ""}
				</Typography>
			</Tooltip>
		</Box>
	);
}

function DifficultyControls(props: {
	policy: Policy;
	setPolicy: (newPolicy: Policy) => void;
	mute: boolean;
	setMute: (newV: boolean) => void;
	sightread: boolean;
	setSightreadMode: (newV: boolean) => void;
}) {
	const { policy, setPolicy, mute, setMute, setSightreadMode, sightread } = props;

	return (
		<Box display="flex" justifyContent="center" alignItems="center">
			<Select
				onChange={(v): void => {
					const difficultyStr = v.target.value;
					setPolicy(DIFFICULTIES.find((v) => v.label === difficultyStr)!);
				}}
				value={policy.label}
				style={{ marginRight: 20 }}
			>
				<MenuItem value={EASY.label}>{EASY.label}</MenuItem>
				<MenuItem value={MEDIUM.label}>{MEDIUM.label}</MenuItem>
				<MenuItem value={HARD.label}>{HARD.label}</MenuItem>
			</Select>
			<Button onClick={() => setMute(!mute)}>
				{mute ? <VolumeOff sx={{ color: "white" }} /> : <VolumeUpIcon sx={{ color: "white" }} />}
			</Button>
			<Tooltip
				title={
					<>
						<Typography fontWeight="600">Sightread Mode</Typography>
						<Typography>Notes are only visible once time starts</Typography>{" "}
					</>
				}
			>
				<Button onClick={() => setSightreadMode(!sightread)}>
					{sightread ? (
						<VisibilityOutlined sx={{ color: "white" }} />
					) : (
						<VisibilityOffOutlined sx={{ color: "white" }} />
					)}
				</Button>
			</Tooltip>
		</Box>
	);
}

export default App;
