import { createClient } from "npm:@supabase/supabase-js@^2.95.0";

type SubmittedRound = {
  questionId: string;
  guess: number;
  secondsLeft: number;
};

type RequestBody = {
  nickname?: string;
  difficulty?: "10" | "50" | "100" | "all";
  rounds?: SubmittedRound[];
};

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const headers = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers });
}

function scoreAnswer(guess: number, answer: number, secondsLeft: number) {
  const error = Math.abs(guess - answer);
  const accuracy = Math.max(80, 1000 - error * 360);
  const speed = error === 0
    ? Math.min(220, Math.round(secondsLeft * 1.5))
    : Math.min(90, Math.round(secondsLeft * 0.5));
  return accuracy + speed;
}

function readSupabaseAdminKey() {
  const direct = Deno.env.get("SUPABASE_SECRET_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (direct) return direct;

  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0];
  } catch {
    return undefined;
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return response({ error: "POST 요청만 지원합니다." }, 405);

  const origin = request.headers.get("origin");
  if (allowedOrigin !== "*" && origin !== allowedOrigin) {
    return response({ error: "허용되지 않은 출처입니다." }, 403);
  }

  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return response({ error: "JSON 요청 본문이 필요합니다." }, 400);
  }

  const difficulty = body.difficulty ?? "all";
  const nickname = (body.nickname ?? "익명의 여행자").trim().slice(0, 16);
  const rounds = body.rounds;

  if (!nickname || !["10", "50", "100", "all"].includes(difficulty)) {
    return response({ error: "닉네임 또는 난이도 값이 올바르지 않습니다." }, 400);
  }
  if (!Array.isArray(rounds) || rounds.length < 1 || rounds.length > 5) {
    return response({ error: "1~5개의 라운드 결과가 필요합니다." }, 400);
  }

  const ids = rounds.map((round) => round.questionId);
  if (new Set(ids).size !== ids.length) return response({ error: "중복 문제가 포함되어 있습니다." }, 400);
  if (rounds.some((round) =>
    typeof round.questionId !== "string"
    || !Number.isInteger(round.guess)
    || round.guess < 0
    || round.guess > 20
    || !Number.isFinite(round.secondsLeft)
    || round.secondsLeft < 0
    || round.secondsLeft > 180
  )) {
    return response({ error: "라운드 값의 범위를 확인해 주세요." }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const adminKey = readSupabaseAdminKey();
  if (!supabaseUrl || !adminKey) return response({ error: "서버 설정이 완료되지 않았습니다." }, 500);

  const admin = createClient(supabaseUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: questions, error: questionError } = await admin
    .from("game_questions")
    .select("id, minimum_transfers")
    .in("id", ids)
    .eq("is_active", true);

  if (questionError) return response({ error: "정답을 조회하지 못했습니다." }, 500);
  if (!questions || questions.length !== ids.length) return response({ error: "만료되었거나 없는 문제가 포함되어 있습니다." }, 400);

  const answerMap = new Map(questions.map((question) => [question.id, question.minimum_transfers]));
  let totalScore = 0;
  let exactAnswers = 0;
  const checkedRounds = rounds.map((round) => {
    const answer = answerMap.get(round.questionId)!;
    const points = scoreAnswer(round.guess, answer, Math.round(round.secondsLeft));
    const exact = round.guess === answer;
    totalScore += points;
    if (exact) exactAnswers += 1;
    return { questionId: round.questionId, guess: round.guess, answer, points, exact };
  });

  const { data: saved, error: insertError } = await admin
    .from("leaderboard_scores")
    .insert({
      nickname,
      total_score: totalScore,
      exact_answers: exactAnswers,
      difficulty,
      rounds_count: rounds.length,
    })
    .select("id, created_at")
    .single();

  if (insertError) return response({ error: "점수를 저장하지 못했습니다." }, 500);

  return response({ id: saved.id, createdAt: saved.created_at, totalScore, exactAnswers, rounds: checkedRounds });
});
