'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const VALID_ID = 'botong826'
const VALID_PW = 'asd1568*'
const SESSION_COOKIE = 'auth_session'

export type LoginState = { error?: string } | undefined

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const id = (formData.get('id') as string)?.trim()
  const password = formData.get('password') as string

  if (id === VALID_ID && password === VALID_PW) {
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, 'authenticated', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    redirect('/')
  }

  return { error: '아이디 또는 비밀번호가 올바르지 않습니다.' }
}

export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
  redirect('/login')
}
