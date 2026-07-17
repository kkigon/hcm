"use client";

import {
  ArrowRight,
  BusFront,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Footprints,
  Lightbulb,
  LocateFixed,
  MapPin,
  Minus,
  NotebookPen,
  Play,
  Plus,
  RotateCcw,
  Route,
  Search,
  Settings2,
  TrainFront,
  Trophy,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GameMap, type MapPhase } from "./GameMap";
import {
  allSearchableStops,
  DIFFICULTY_OPTIONS,
  makeRoundQuestions,
  QUESTIONS,
  type Difficulty,
  type LngLat,
  type Question,
  type RouteLeg,
  type Stop,
} from "../data/questions";

type ActiveTab = "explore" | "memo" | "route";

type RoundResult = {
  questionId: string;
  guess: number;
  answer: number;
  points: number;
  exact: boolean;
  timedOut: boolean;
};

const ROUND_COUNT = 5;
const TIME_OPTIONS = [90, 120, 180];

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function scoreAnswer(guess: number, answer: number, secondsLeft: number) {
  const error = Math.abs(guess - answer);
  const accuracy = Math.max(80, 1000 - error * 360);
  const speed = error === 0 ? Math.min(220, Math.round(secondsLeft * 1.5)) : Math.min(90, Math.round(secondsLeft * 0.5));
  return accuracy + speed;
}

function modeIcon(leg: RouteLeg) {
  if (leg.mode === "walk") return <Footprints size={16} strokeWidth={2.2} />;
  if (leg.mode === "bus") return <BusFront size={16} strokeWidth={2.2} />;
  return <TrainFront size={16} strokeWidth={2.2} />;
}

function pointFor(name: "origin" | "destination", question: Question): { coordinates: LngLat; title: string } {
  const point = question[name];
  return { coordinates: point.coordinates, title: point.name };
}

export function TransitGame() {
  const [phase, setPhase] = useState<MapPhase>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("50");
  const [timeLimit, setTimeLimit] = useState(120);
  const [questions, setQuestions] = useState<Question[]>(() =>
    QUESTIONS.filter((question) => question.difficulty === "50").slice(0, ROUND_COUNT),
  );
  const [roundIndex, setRoundIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(120);
  const [countdown, setCountdown] = useState(3);
  const [guess, setGuess] = useState(1);
  const [score, setScore] = useState(0);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [currentResult, setCurrentResult] = useState<RoundResult | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("explore");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ coordinates: LngLat; key: number } | null>(null);
  const [memo, setMemo] = useState("");
  const [bestScore, setBestScore] = useState(0);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const focusKeyRef = useRef(0);
  const guessRef = useRef(guess);
  const submitLockRef = useRef(false);
  const summaryRecordedRef = useRef(false);

  const currentQuestion = questions[roundIndex] ?? QUESTIONS[0];
  const progress = Math.max(0, Math.min(1, timeLeft / timeLimit));
  const exactCount = results.filter((result) => result.exact).length;

  useEffect(() => {
    guessRef.current = guess;
  }, [guess]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedBest = Number(window.localStorage.getItem("hwanchwemyeot-best") ?? 0);
      const savedGames = Number(window.localStorage.getItem("hwanchwemyeot-played") ?? 0);
      setBestScore(savedBest);
      setGamesPlayed(savedGames);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return;
    const interval = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          setTimeLeft(timeLimit);
          setPhase("playing");
          return 0;
        }
        return value - 1;
      });
    }, 820);
    return () => window.clearInterval(interval);
  }, [phase, timeLimit]);

  const revealAnswer = useCallback(
    (timedOut: boolean) => {
      if (submitLockRef.current || phase !== "playing") return;
      submitLockRef.current = true;
      const finalGuess = guessRef.current;
      const points = scoreAnswer(finalGuess, currentQuestion.minimumTransfers, timedOut ? 0 : timeLeft);
      const result: RoundResult = {
        questionId: currentQuestion.id,
        guess: finalGuess,
        answer: currentQuestion.minimumTransfers,
        points,
        exact: finalGuess === currentQuestion.minimumTransfers,
        timedOut,
      };
      setCurrentResult(result);
      setResults((items) => [...items, result]);
      setScore((value) => value + points);
      setConfirmOpen(false);
      setActiveTab("route");
      setPhase("reveal");
      window.setTimeout(() => {
        submitLockRef.current = false;
      }, 300);
    }, [currentQuestion.id, currentQuestion.minimumTransfers, phase, timeLeft],
  );

  useEffect(() => {
    if (phase !== "playing") return;
    const interval = window.setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          window.clearInterval(interval);
          window.setTimeout(() => revealAnswer(true), 0);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [phase, revealAnswer]);

  useEffect(() => {
    if (phase !== "summary" || summaryRecordedRef.current) return;
    summaryRecordedRef.current = true;
    const nextBest = Math.max(bestScore, score);
    const nextPlayed = gamesPlayed + 1;
    setBestScore(nextBest);
    setGamesPlayed(nextPlayed);
    window.localStorage.setItem("hwanchwemyeot-best", String(nextBest));
    window.localStorage.setItem("hwanchwemyeot-played", String(nextPlayed));
    // summary 진입 때 한 번만 기록한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const searchResults = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return [];
    return allSearchableStops
      .filter((stop) => `${stop.name} ${stop.kind} ${stop.lines.join(" ")}`.toLowerCase().includes(term))
      .slice(0, 6);
  }, [searchTerm]);

  const flyTo = useCallback((coordinates: LngLat) => {
    focusKeyRef.current += 1;
    setFocusTarget({ coordinates, key: focusKeyRef.current });
  }, []);

  const handleStopSelect = useCallback(
    (stop: Stop) => {
      setSelectedStop(stop);
      if (phase !== "reveal") setActiveTab("explore");
      flyTo(stop.coordinates);
    },
    [flyTo, phase],
  );

  function startGame() {
    summaryRecordedRef.current = false;
    setCountdown(3);
    const nextQuestions = makeRoundQuestions(difficulty, ROUND_COUNT);
    setQuestions(nextQuestions);
    setRoundIndex(0);
    setGuess(1);
    setScore(0);
    setResults([]);
    setCurrentResult(null);
    setSelectedStop(null);
    setSearchTerm("");
    setMemo("");
    setActiveTab("explore");
    setTimeLeft(timeLimit);
    setPhase("countdown");
  }

  function nextRound() {
    if (roundIndex >= questions.length - 1) {
      setPhase("summary");
      return;
    }
    setCountdown(3);
    setRoundIndex((value) => value + 1);
    setGuess(1);
    setCurrentResult(null);
    setSelectedStop(null);
    setSearchTerm("");
    setMemo("");
    setActiveTab("explore");
    setTimeLeft(timeLimit);
    setPhase("countdown");
  }

  function goToMenu() {
    setPhase("menu");
    setConfirmOpen(false);
    setCurrentResult(null);
    setSelectedStop(null);
  }

  function selectSearchStop(stop: Stop) {
    setSelectedStop(stop);
    setSearchTerm(stop.name);
    flyTo(stop.coordinates);
  }

  return (
    <main className={`game-root phase-${phase}`}>
      <div className="game-shell">
        <aside className="side-panel" aria-hidden={phase === "menu" || phase === "summary"}>
          <header className="side-header">
            <button className="mini-brand" type="button" onClick={goToMenu} aria-label="메인 메뉴로 이동">
              <span className="mini-brand__mark"><Route size={18} /></span>
              <span>환최몇?</span>
            </button>
            <div className="round-score">
              <span>{roundIndex + 1} / {questions.length}</span>
              <strong>{score.toLocaleString()}점</strong>
            </div>
          </header>

          <section className={`timer-card ${timeLeft <= 20 ? "is-urgent" : ""}`} aria-label={`남은 시간 ${formatTime(timeLeft)}`}>
            <div className="timer-card__top">
              <span><Clock3 size={16} /> 남은 시간</span>
              <strong>{formatTime(timeLeft)}</strong>
            </div>
            <div className="timer-track"><span style={{ transform: `scaleX(${progress})` }} /></div>
          </section>

          <nav className="side-tabs" aria-label="게임 정보 탭">
            <button type="button" className={activeTab === "explore" ? "is-active" : ""} onClick={() => setActiveTab("explore")}>
              <Search size={15} /> 교통 탐색
            </button>
            <button type="button" className={activeTab === "memo" ? "is-active" : ""} onClick={() => setActiveTab("memo")}>
              <NotebookPen size={15} /> 메모
            </button>
            <button
              type="button"
              className={activeTab === "route" ? "is-active" : ""}
              disabled={phase !== "reveal"}
              onClick={() => setActiveTab("route")}
            >
              <Route size={15} /> 정답 경로
            </button>
          </nav>

          <div className="side-content">
            {activeTab === "explore" && (
              <div className="explore-pane">
                <label className="stop-search">
                  <Search size={18} />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="역·정류장·노선 검색"
                    aria-label="역, 정류장 또는 노선 검색"
                    disabled={phase === "countdown"}
                  />
                  {searchTerm && <button type="button" onClick={() => setSearchTerm("")} aria-label="검색어 지우기"><X size={15} /></button>}
                </label>

                {searchTerm && (
                  <div className="search-results" role="listbox" aria-label="교통 검색 결과">
                    {searchResults.length > 0 ? searchResults.map((stop) => (
                      <button type="button" key={stop.id} onClick={() => selectSearchStop(stop)}>
                        <span className={`transport-dot transport-dot--${stop.kind === "버스정류장" ? "bus" : "rail"}`}>
                          {stop.kind === "버스정류장" ? <BusFront size={15} /> : <TrainFront size={15} />}
                        </span>
                        <span><strong>{stop.name}</strong><small>{stop.kind} · {stop.lines.slice(0, 2).join(" · ")}</small></span>
                        <ChevronRight size={16} />
                      </button>
                    )) : <p className="empty-result">검색 가능한 교통 정보가 없어요.</p>}
                  </div>
                )}

                {selectedStop ? (
                  <section className="selected-stop-card">
                    <div className="section-kicker">선택한 교통 거점</div>
                    <div className="selected-stop-card__title">
                      <span className="transport-dot transport-dot--rail"><TrainFront size={16} /></span>
                      <div><strong>{selectedStop.name}</strong><small>{selectedStop.kind}</small></div>
                      <button type="button" onClick={() => flyTo(selectedStop.coordinates)} aria-label={`${selectedStop.name} 위치로 이동`}><LocateFixed size={17} /></button>
                    </div>
                    <p>{selectedStop.description}</p>
                    <div className="line-chips">{selectedStop.lines.map((line) => <span key={line}>{line}</span>)}</div>
                  </section>
                ) : (
                  <section className="nearby-section">
                    <div className="section-heading">
                      <div><span className="section-kicker">문제 지점</span><h2>가까운 대중교통</h2></div>
                      <span className="rule-chip"><Footprints size={13} /> 1km 이내</span>
                    </div>
                    <button className="nearby-card" type="button" onClick={() => flyTo(currentQuestion.origin.coordinates)}>
                      <span className="endpoint-badge endpoint-badge--start">출</span>
                      <span><small>{currentQuestion.origin.name}</small><strong>{currentQuestion.origin.nearestStop}</strong><em>도보 {currentQuestion.origin.walkMeters}m</em></span>
                      <LocateFixed size={17} />
                    </button>
                    <button className="nearby-card" type="button" onClick={() => flyTo(currentQuestion.destination.coordinates)}>
                      <span className="endpoint-badge endpoint-badge--finish">도</span>
                      <span><small>{currentQuestion.destination.name}</small><strong>{currentQuestion.destination.nearestStop}</strong><em>도보 {currentQuestion.destination.walkMeters}m</em></span>
                      <LocateFixed size={17} />
                    </button>
                  </section>
                )}

                <div className="no-route-notice">
                  <Route size={18} />
                  <p><strong>경로검색은 잠겨 있어요.</strong><span>지도와 역·정류장 정보만으로 추리해 보세요.</span></p>
                </div>
              </div>
            )}

            {activeTab === "memo" && (
              <div className="memo-pane">
                <span className="section-kicker">나만의 추리 노트</span>
                <h2>갈아탈 지점을 적어두세요</h2>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  placeholder={`예) ${currentQuestion.origin.nearestStop}에서 ○○선 → …`}
                  maxLength={500}
                  disabled={phase === "countdown"}
                />
                <small>{memo.length} / 500 · 다음 라운드에서 자동으로 지워져요</small>
                <div className="memo-tip"><Lightbulb size={17} /><span>{currentQuestion.hint}</span></div>
              </div>
            )}

            {activeTab === "route" && currentResult && (
              <div className="route-pane">
                <div className={`answer-summary ${currentResult.exact ? "is-exact" : ""}`}>
                  <span>{currentResult.exact ? "정확해요!" : `오차 ${Math.abs(currentResult.guess - currentResult.answer)}회`}</span>
                  <strong>최소 {currentResult.answer}회 환승</strong>
                  <small>내 답 {currentResult.guess}회 · +{currentResult.points.toLocaleString()}점</small>
                </div>
                <div className="route-meta">
                  <span><Clock3 size={14} /> 약 {currentQuestion.estimatedMinutes}분</span>
                  <span><MapPin size={14} /> {currentQuestion.distanceKm}km</span>
                </div>
                <div className="route-steps">
                  {currentQuestion.legs.map((leg, index) => (
                    <div className={`route-step route-step--${leg.mode}`} key={`${leg.label}-${index}`}>
                      <div className="route-step__rail">
                        <span style={{ background: leg.color }}>{modeIcon(leg)}</span>
                        {index < currentQuestion.legs.length - 1 && <i style={{ borderColor: leg.mode === "walk" ? "#b7c0c8" : leg.color }} />}
                      </div>
                      <div className="route-step__body">
                        <div><strong>{leg.label}</strong><span>{leg.minutes}분</span></div>
                        <p>{leg.from} <ArrowRight size={12} /> {leg.to}</p>
                        <small>{leg.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="verified-note"><Check size={14} /> {currentQuestion.verifiedLabel} · 도보 구간 1km 이내</div>
              </div>
            )}
          </div>

          <footer className="answer-panel">
            {phase === "reveal" && currentResult ? (
              <button className="primary-action" type="button" onClick={nextRound}>
                {roundIndex === questions.length - 1 ? "최종 결과 보기" : "다음 문제"}<ArrowRight size={19} />
              </button>
            ) : (
              <>
                <p>최소 환승은 몇 번일까요?</p>
                <div className="answer-controls">
                  <div className="number-stepper" aria-label={`예상 환승 횟수 ${guess}회`}>
                    <button type="button" onClick={() => setGuess((value) => Math.max(0, value - 1))} disabled={phase !== "playing" || guess === 0} aria-label="환승 횟수 줄이기"><Minus size={18} /></button>
                    <strong>{guess}<small>회</small></strong>
                    <button type="button" onClick={() => setGuess((value) => Math.min(9, value + 1))} disabled={phase !== "playing" || guess === 9} aria-label="환승 횟수 늘리기"><Plus size={18} /></button>
                  </div>
                  <button className="submit-answer" type="button" onClick={() => setConfirmOpen(true)} disabled={phase !== "playing"}>제출</button>
                </div>
              </>
            )}
          </footer>
        </aside>

        <section className="map-stage">
          <div className="map-visual">
            <GameMap
              question={currentQuestion}
              phase={phase}
              focusTarget={focusTarget}
              selectedStop={selectedStop}
              onStopSelect={handleStopSelect}
            />
          </div>

          {phase !== "menu" && phase !== "summary" && (
            <div className="question-bar">
              <button type="button" onClick={() => flyTo(pointFor("origin", currentQuestion).coordinates)}>
                <span className="endpoint-badge endpoint-badge--start">출</span>
                <span><small>출발지</small><strong>{currentQuestion.origin.name}</strong><em>{currentQuestion.origin.address}</em></span>
                <LocateFixed size={17} />
              </button>
              <div className="question-connector"><i /><span>{currentQuestion.distanceKm} km</span><i /></div>
              <button type="button" onClick={() => flyTo(pointFor("destination", currentQuestion).coordinates)}>
                <span className="endpoint-badge endpoint-badge--finish">도</span>
                <span><small>도착지</small><strong>{currentQuestion.destination.name}</strong><em>{currentQuestion.destination.address}</em></span>
                <LocateFixed size={17} />
              </button>
            </div>
          )}

          {phase === "reveal" && currentResult && (
            <div className={`map-result-toast ${currentResult.exact ? "is-exact" : ""}`}>
              <span>{currentResult.exact ? <Trophy size={20} /> : <Route size={20} />}</span>
              <p><small>{currentResult.timedOut ? "시간 종료" : "정답 공개"}</small><strong>최소 {currentResult.answer}회 환승</strong></p>
              <em>+{currentResult.points.toLocaleString()}</em>
            </div>
          )}
        </section>
      </div>

      {phase === "menu" && (
        <div className="menu-layer">
          <section className="menu-card" aria-label="게임 설정">
            <div className="menu-card__glow" />
            <div className="brand-lockup">
              <span className="brand-symbol"><Route size={29} /></span>
              <div><h1>환최몇?</h1><span>PUBLIC TRANSIT PUZZLE</span></div>
            </div>
            <p className="catchphrase">대한민국의 대중교통으로<br /><strong>어디까지 갈 수 있을까요?</strong></p>
            <div className="menu-divider"><span>최소 환승 횟수를 맞혀보세요</span></div>

            <fieldset className="setting-group">
              <legend><Settings2 size={16} /> 거리 난이도</legend>
              <div className="difficulty-grid">
                {DIFFICULTY_OPTIONS.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    className={difficulty === option.id ? "is-active" : ""}
                    onClick={() => setDifficulty(option.id)}
                    aria-pressed={difficulty === option.id}
                  >
                    <strong>{option.label}</strong><span>{option.range}</span>
                    {difficulty === option.id && <i><Check size={12} /></i>}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="setting-row">
              <div><Clock3 size={16} /><span><strong>문제당 제한시간</strong><small>기본 2분</small></span></div>
              <div className="time-options">
                {TIME_OPTIONS.map((seconds) => (
                  <button type="button" key={seconds} onClick={() => setTimeLimit(seconds)} className={timeLimit === seconds ? "is-active" : ""}>{seconds / 60 < 1 ? `${seconds}초` : `${seconds / 60}분`}</button>
                ))}
              </div>
            </div>

            <button className="start-button" type="button" onClick={startGame}>
              <span><Play size={20} fill="currentColor" /> 게임 시작</span><ArrowRight size={21} />
            </button>

            <div className="menu-card__bottom">
              <button type="button" onClick={() => setHelpOpen(true)}><CircleHelp size={16} /> 게임 방법</button>
              <span>5 ROUND · {QUESTIONS.length}개 검증 문제</span>
              <span>BEST {bestScore.toLocaleString()}</span>
            </div>
          </section>
          <div className="menu-credit"><span className="live-dot" /> 버스 · 지하철 · 기차 / 도보 환승 1km 이하</div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="countdown-layer" aria-live="assertive">
          <span>ROUND {roundIndex + 1}</span>
          <strong key={countdown}>{countdown || "GO"}</strong>
          <p>{currentQuestion.distanceKm}km의 두 지점을 연결하세요</p>
        </div>
      )}

      {phase === "summary" && (
        <div className="summary-layer">
          <section className="summary-card">
            <div className="summary-trophy"><Trophy size={34} /></div>
            <span className="summary-eyebrow">5라운드 여정 완료</span>
            <h2>{score.toLocaleString()}<small>점</small></h2>
            <p>{exactCount >= 4 ? "환승 감각이 거의 노선도 수준이에요." : exactCount >= 2 ? "좋아요. 몇 번만 더 달리면 환승 고수예요." : "지도는 볼수록 길이 보여요. 한 번 더 가볼까요?"}</p>
            <div className="summary-stats">
              <div><span>정답</span><strong>{exactCount}<small>/5</small></strong></div>
              <div><span>최고 기록</span><strong>{Math.max(bestScore, score).toLocaleString()}</strong></div>
              <div><span>플레이</span><strong>{gamesPlayed}<small>회</small></strong></div>
            </div>
            <div className="round-dots" aria-label="라운드별 결과">
              {results.map((result, index) => <span key={result.questionId + index} className={result.exact ? "is-exact" : ""} title={`${index + 1}라운드 ${result.points}점`}>{index + 1}</span>)}
            </div>
            <button className="start-button" type="button" onClick={startGame}><span><RotateCcw size={19} /> 같은 설정으로 다시</span><ArrowRight size={21} /></button>
            <button className="text-action" type="button" onClick={goToMenu}>난이도 다시 고르기</button>
          </section>
        </div>
      )}

      {confirmOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <button className="modal-close" type="button" onClick={() => setConfirmOpen(false)} aria-label="닫기"><X size={18} /></button>
            <span className="confirm-icon"><Route size={25} /></span>
            <h2 id="confirm-title">{guess}회로 확정할까요?</h2>
            <p>제출하면 남은 시간이 있어도 답을 바꿀 수 없어요. 정답 경로가 지도에 바로 표시됩니다.</p>
            <div className="modal-actions">
              <button type="button" onClick={() => setConfirmOpen(false)}>조금 더 보기</button>
              <button type="button" onClick={() => revealAnswer(false)}>정답 제출</button>
            </div>
          </section>
        </div>
      )}

      {helpOpen && (
        <div className="modal-backdrop" role="presentation">
          <section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title">
            <button className="modal-close" type="button" onClick={() => setHelpOpen(false)} aria-label="닫기"><X size={18} /></button>
            <span className="section-kicker">HOW TO PLAY</span>
            <h2 id="help-title">환승은 적게, 추리는 깊게</h2>
            <ol>
              <li><span>1</span><p><strong>두 지점을 확인하세요</strong>주소 카드를 누르면 지도가 해당 위치로 이동해요.</p></li>
              <li><span>2</span><p><strong>교통 정보를 탐색하세요</strong>역·정류장과 노선은 볼 수 있지만 경로검색은 할 수 없어요.</p></li>
              <li><span>3</span><p><strong>최소 환승 횟수를 제출하세요</strong>도보 이동은 각 구간 1km 이하만 정답으로 인정돼요.</p></li>
              <li><span>4</span><p><strong>정답 경로를 복기하세요</strong>지도 애니메이션과 단계별 이동수단으로 확인할 수 있어요.</p></li>
            </ol>
            <div className="help-rule"><Footprints size={18} /><span>승차 횟수가 1번이면 환승은 <strong>0회</strong>입니다.</span></div>
            <button className="primary-action" type="button" onClick={() => setHelpOpen(false)}>알겠어요</button>
          </section>
        </div>
      )}
    </main>
  );
}
