import { getFreshSession } from './auth';
import { supabaseConfig } from './config';

/**
 * 온라인 계정의 프리미엄 상태를 확인하는 헬퍼 함수
 */
export async function checkOnlinePremiumStatus(
  userId: string | null
): Promise<{ active: boolean; expiresAt: number | null }> {
  if (!userId || !supabaseConfig) return { active: false, expiresAt: null };
  try {
    const session = await getFreshSession();
    if (!session || session.userId !== userId) return { active: false, expiresAt: null };

    const response = await fetch(supabaseConfig.url + '/rest/v1/rpc/get_premium_status', {
      method: 'POST',
      headers: {
        apikey: supabaseConfig.publishableKey,
        Authorization: 'Bearer ' + session.accessToken,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    if (!response.ok) return { active: false, expiresAt: null };
    const data = await response.json();
    const serverNow = Number.isFinite(data.serverNow) ? data.serverNow : Date.now();
    const active =
      Number.isFinite(data.expiresAt) && data.expiresAt !== null && data.expiresAt > serverNow;
    return { active, expiresAt: data.expiresAt };
  } catch {
    return { active: false, expiresAt: null };
  }
}
