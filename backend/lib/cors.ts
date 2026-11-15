import { NextResponse } from 'next/server';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin',
};

export function handleOptions() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function jsonResponse(data: any, init?: number | ResponseInit) {
  const options: ResponseInit = typeof init === 'number' ? { status: init } : (init || {});
  return NextResponse.json(data, {
    ...options,
    headers: {
      ...corsHeaders,
      ...(options.headers || {}),
    },
  });
}

export function errorResponse(message: string | any, status = 400) {
  return NextResponse.json(
    typeof message === 'string' ? { detail: message } : message,
    {
      status,
      headers: corsHeaders,
    }
  );
}
