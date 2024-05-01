import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { Box, Button, FormControl, InputLabel, Select, Typography } from "@mui/material";
import MenuItem from "@mui/material/MenuItem";
import useSound from "use-sound";
import { createTheme, styled, ThemeProvider } from "@mui/material/styles";
import ForwardIcon from "@mui/icons-material/Forward";
import { VolumeOff } from "@mui/icons-material";
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
	const policyRef = useRef(policy);
	const [click] = useSound("/click.mp3", { volume: mute ? 0.00000001 : 1 });
	const [failureSound] = useSound("/failure.mp3", { volume: mute ? 0.0000001 : 1 });
	const [successSound] = useSound("/success.mp3", { volume: mute ? 0.000001 : 1 });

	useEffect(() => {
		policyRef.current = policy;
	}, [policyRef, policy]);
	const reset = useCallback(() => {
		setCombo(generateSequence(policyRef.current));
		setProgress(0);
		setStateIndication(StateIndication.Normal);
	}, [setCombo, setProgress, policyRef]);

	useEffect(() => reset(), [reset, policy]);

	const initiateError = useCallback(() => {
		setStateIndication(StateIndication.Error);
		failureSound();
		setTimeout(() => {
			reset();
		}, ERROR_FLASHING_TIME);
	}, [setStateIndication, reset, failureSound]);

	const success = useCallback(() => {
		setStateIndication(StateIndication.Success);
		successSound();
		setTimeout(() => {
			reset();
		}, ERROR_FLASHING_TIME);
	}, [setStateIndication, reset, successSound]);

	const onKeyDown = useCallback(
		(key: Direction) => {
			if (stateIndication !== StateIndication.Normal) {
				return;
			}
			const nextNeeded = combo[progress];
			click();
			console.log("key gotten!", nextNeeded, combo, progress, key);
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
		[combo, progress, success, setProgress, click]
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
				<TerminalScreen currCombo={combo} progress={progress} gameState={stateIndication} />

				<DifficultyControls policy={policy} setPolicy={setPolicy} mute={mute} setMute={setMute} />
			</AppContainer>
		</ThemeProvider>
	);
}

const keys: Record<string, Direction> = {
	w: Direction.up,
	a: Direction.left,
	s: Direction.down,
	d: Direction.right,
};

function identifyDirection(key: string): Direction | undefined {
	return keys[key];
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

function TerminalScreen(props: { currCombo: Combo; progress: number; gameState: StateIndication }) {
	const { currCombo, progress, gameState } = props;

	return (
		<Box display="flex" justifyContent="center" marginTop="20vh">
			{currCombo.map((ele, index) => {
				const status = calculcateArrowStatus(gameState, progress, index);
				console.log(index, status, progress);
				return <ArrowDisplay key={index} type={ele} version={status} />;
			})}
		</Box>
	);
}

function calculcateArrowStatus(gameState: StateIndication, progress: number, index: number): ArrowState {
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
	return "pending";
}

type ArrowState = "error" | "success" | "completed" | "pending";

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

	return "baseArrow normalArrow";
}

function DifficultyControls(props: {
	policy: Policy;
	setPolicy: (newPolicy: Policy) => void;
	mute: boolean;
	setMute: (newV: boolean) => void;
}) {
	const { policy, setPolicy, mute, setMute } = props;
	return (
		<Box display="flex" justifyContent="center">
			<Select
				onChange={(v): void => {
					const difficultyStr = v.target.value;
					setPolicy(DIFFICULTIES.find((v) => v.label === difficultyStr)!);
				}}
				value={policy.label}
			>
				<MenuItem value={EASY.label}>{EASY.label}</MenuItem>
				<MenuItem value={MEDIUM.label}>{MEDIUM.label}</MenuItem>
				<MenuItem value={HARD.label}>{HARD.label}</MenuItem>
			</Select>
			<Button onClick={() => setMute(!mute)}>
				{mute ? <VolumeUpIcon sx={{ color: "white" }} /> : <VolumeOff sx={{ color: "white" }} />}
			</Button>
		</Box>
	);
}

export default App;
