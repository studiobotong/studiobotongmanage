'use client'

import { useActionState } from 'react'
import { Sparkles, ArrowRight, Lock, User, AlertCircle } from 'lucide-react'
import { login, type LoginState } from '@/app/actions/auth'

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    login,
    undefined
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f2ff] via-[#f8f9fb] to-[#f0f4ff] flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#5b6af4]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-[#818cf8]/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/60 border border-white/80 p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#5b6af4] to-[#818cf8] flex items-center justify-center shadow-lg shadow-indigo-200 mb-4">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">스튜디오 보통</h1>
            <p className="text-sm text-gray-400 mt-1">관리자 전용 대시보드</p>
          </div>

          {/* Form */}
          <form className="space-y-4" action={formAction}>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                아이디
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="text"
                  name="id"
                  placeholder="아이디 입력"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/20 focus:border-[#5b6af4] focus:bg-white transition-all placeholder-gray-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                비밀번호
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="password"
                  name="password"
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#5b6af4]/20 focus:border-[#5b6af4] focus:bg-white transition-all placeholder-gray-300"
                />
              </div>
            </div>

            {/* Error message */}
            {state?.error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <p className="text-xs text-red-600">{state.error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#5b6af4] text-white text-sm font-semibold hover:bg-[#4a58e8] shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-200 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  로그인
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] text-gray-300 uppercase tracking-wider">
                관리자 전용
              </span>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-gray-50 rounded-xl p-3.5 text-center">
            <p className="text-xs text-gray-400 leading-relaxed">
              이 대시보드는 <strong className="text-gray-600">스튜디오 보통</strong> 운영자만 접근할 수 있습니다.
              <br />
              계정 문의는 운영팀에 연락하세요.
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-300 mt-6">
          © 2025 스튜디오 보통. All rights reserved.
        </p>
      </div>
    </div>
  )
}
