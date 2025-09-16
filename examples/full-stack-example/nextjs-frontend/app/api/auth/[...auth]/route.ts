import { auth } from "@/lib/auth";
import { NextRequest } from "next/server";

const originalHandler = auth.handler;

// Wrapper to add logging
const handler = async (req: NextRequest) => {
  console.log(`🔍 [AUTH DEBUG] ${req.method} ${req.url}`);

  try {
    if (req.method === 'POST') {
      const body = await req.clone().json().catch(() => ({}));
      console.log('🔍 [AUTH DEBUG] Request body:', JSON.stringify(body, null, 2));
    } else if (req.method === 'GET') {
      const cookies = req.headers.get('cookie');
      console.log('🔍 [AUTH DEBUG] GET request cookies:', cookies ? 'Present' : 'None');
    }
  } catch (e) {
    console.log('🔍 [AUTH DEBUG] Could not parse request');
  }

  try {
    const result = await originalHandler(req);
    console.log('🔍 [AUTH DEBUG] Success response status:', result.status);

    // For get-session calls, log the response body
    if (req.url.includes('get-session')) {
      const responseText = await result.clone().text();
      console.log('🔍 [AUTH DEBUG] get-session response:', responseText);
    }

    return result;
  } catch (error) {
    console.error('🔍 [AUTH DEBUG] Handler error:', error);
    throw error;
  }
};

export { handler as GET, handler as POST };