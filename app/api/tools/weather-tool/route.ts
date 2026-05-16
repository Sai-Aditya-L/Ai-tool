import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Fog', 48: 'Icy fog', 51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail',
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const city = req.nextUrl.searchParams.get('city')
  const countryCode = req.nextUrl.searchParams.get('country_code')
  if (!city) return NextResponse.json({ error: 'Missing city' }, { status: 400 })

  try {
    // Geocode
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}${countryCode ? `&country_code=${countryCode}` : ''}&count=1&language=en&format=json`
    const geoRes = await fetch(geoUrl)
    const geoData = await geoRes.json()
    const location = geoData?.results?.[0]
    if (!location) return NextResponse.json({ error: `City "${city}" not found` }, { status: 404 })

    const { latitude, longitude, name, country, timezone } = location

    // Weather
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,windspeed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum&timezone=${encodeURIComponent(timezone)}&forecast_days=3`
    const weatherRes = await fetch(weatherUrl)
    const weatherData = await weatherRes.json()
    const cw = weatherData.current_weather
    const daily = weatherData.daily

    const forecast = (daily?.time || []).slice(0, 3).map((date: string, i: number) => ({
      date,
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      condition: WMO_CODES[daily.weathercode[i]] || 'Unknown',
      precipitation: daily.precipitation_sum[i],
    }))

    return NextResponse.json({
      city: name,
      country,
      temperature: Math.round(cw.temperature),
      condition: WMO_CODES[cw.weathercode] || 'Unknown',
      windspeed: cw.windspeed,
      is_day: cw.is_day === 1,
      forecast,
      unit: 'celsius',
    })
  } catch (e) {
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 500 })
  }
}
