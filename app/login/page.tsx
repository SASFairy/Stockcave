"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleKeyPress = (num: string) => {
    setError("");
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      
      // Auto-submit when 4 digits are reached
      if (newPin.length === 4) {
        submitPin(newPin);
      }
    }
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const submitPin = async (enteredPin: string) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(data.error || "인증에 실패했습니다.");
        setPin(""); // Clear on failure
      }
    } catch (err) {
      setError("서버와 통신하는 중 오류가 발생했습니다.");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50/50 relative overflow-hidden">
      {/* Pure CSS Slow-Floating Ambient Aurora Background Circles */}
      <div className="aurora-bg">
        <div className="aurora-circle aurora-circle-1" />
        <div className="aurora-circle aurora-circle-2" />
        <div className="aurora-circle aurora-circle-3" />
        <div className="aurora-circle aurora-circle-4" />
      </div>

      {/* Main glass card */}
      <div className="w-full max-w-sm p-8 rounded-3xl bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.03)] relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 border border-indigo-100 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-6 h-6 animate-pulse"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">
            Stockcave Portal
          </h1>
          <p className="text-xs text-slate-500 font-bold mt-2">가족 전용 보안 PIN 번호를 입력해 주세요.</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 ${
                index < pin.length
                  ? "bg-indigo-600 border-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.4)]"
                  : "bg-slate-100 border-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-center text-xs text-rose-600 font-bold mb-6 bg-rose-50 border border-rose-100 p-2.5 rounded-xl animate-shake">
            {error}
          </div>
        )}

        {/* Loading state indicator */}
        {loading && (
          <div className="text-center text-xs text-indigo-600 font-bold mb-6 animate-pulse">
            PIN 인증 처리 중...
          </div>
        )}

        {/* Custom Virtual Keypad */}
        <div className="grid grid-cols-3 gap-3.5 max-w-[280px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-2xl text-lg font-extrabold bg-white/60 border border-slate-200/60 hover:bg-white hover:border-indigo-500/20 active:scale-95 transition-all text-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={handleClear}
            className="h-14 rounded-2xl text-xs font-extrabold bg-rose-50 border border-rose-100/60 hover:bg-rose-100 active:scale-95 transition-all text-rose-600 flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress("0")}
            className="h-14 rounded-2xl text-lg font-extrabold bg-white/60 border border-slate-200/60 hover:bg-white hover:border-indigo-500/20 active:scale-95 transition-all text-slate-800 flex items-center justify-center cursor-pointer disabled:opacity-50 shadow-[0_2px_8px_rgba(0,0,0,0.01)]"
          >
            0
          </button>
          <div className="h-14 rounded-2xl flex items-center justify-center text-slate-300">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 text-slate-500"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
