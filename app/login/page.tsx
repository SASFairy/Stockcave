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
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[300px] h-[300px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none" />

      {/* Main glass card */}
      <div className="w-full max-w-sm p-8 rounded-2xl glass-panel shadow-2xl relative z-10 border border-border">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-500/10 text-primary border border-indigo-500/20 mb-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-7 h-7 animate-pulse text-indigo-400"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-indigo-200 to-cyan-200 bg-clip-text text-transparent">
            Stockcave Portal
          </h1>
          <p className="text-xs text-muted mt-2">가족 전용 보안 PIN 번호를 입력해 주세요.</p>
        </div>

        {/* PIN Indicators */}
        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`w-4 h-4 rounded-full border border-border transition-all duration-300 ${
                index < pin.length
                  ? "bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)] border-indigo-400"
                  : "bg-black/20"
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="text-center text-xs text-danger font-medium mb-6 bg-red-500/10 border border-red-500/20 p-2 rounded-lg animate-shake">
            {error}
          </div>
        )}

        {/* Loading state indicator */}
        {loading && (
          <div className="text-center text-xs text-indigo-400 font-medium mb-6 animate-pulse">
            PIN 인증 처리 중...
          </div>
        )}

        {/* Custom Virtual Keypad */}
        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              disabled={loading}
              onClick={() => handleKeyPress(num)}
              className="h-14 rounded-xl text-lg font-semibold bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95 transition-all text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              {num}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={handleClear}
            className="h-14 rounded-xl text-xs font-semibold bg-red-500/10 border border-red-500/10 hover:bg-red-500/20 active:scale-95 transition-all text-red-400 flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            CLEAR
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleKeyPress("0")}
            className="h-14 rounded-xl text-lg font-semibold bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 active:scale-95 transition-all text-white flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            0
          </button>
          <div className="h-14 rounded-xl flex items-center justify-center text-muted/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
