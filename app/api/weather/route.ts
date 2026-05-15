import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const WMO_CODES: Record<number, { label: string; icon: string }> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Icy fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌧️' },
  61: { label: 'Light rain', icon: '🌧️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  71: { label: 'Light snow', icon: '🌨️' },
  73: { label: 'Moderate snow', icon: '❄️' },
  75: { label: 'Heavy snow', icon: '❄️' },
  77: { label: 'Snow grains', icon: '❄️' },
  80: { label: 'Light showers', icon: '🌦️' },
  81: { label: 'Moderate showers', icon: '🌧️' },
  82: { label: 'Violent showers', icon: '⛈️' },
  85: { label: 'Slight snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm + hail', icon: '⛈️' },
  99: { label: 'Thunderstorm + heavy hail', icon: '🌩️' },
}

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const city = req.nextUrl.searchParams.get('city') || 'London'
  const countryCode = req.nextUrl.searchParams.get('country_code')

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}${countryCode ? `&country_code=${countryCode}` : ''}&count=1&language=en&format=json`
    const geoRes = await fetch(geoUrl, { next: { revalidate: 3600 } })
    const geoData = await geoRes.json()
    const location = geoData?.results?.[0]
    if (!location) return NextResponse.json({ error: `City "${city}" not found` }, { status: 404 })

    const { latitude, longitude, name, country, timezone } = location

    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&hourly=relativehumidity_2m,apparent_temperature,precipitation_probability&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_sum,sunrise,sunset&timezone=${encodeURIComponent(timezone)}&forecast_days=5`
    const weatherRes = await fetch(weatherUrl, { next: { revalidate: 300 } })
    const weatherData = await weatherRes.json()
    const cw = weatherData.current_weather
    const daily = weatherData.daily
    const hourly = weatherData.hourly

    // Current hour humidity
    const now = new Date()
    const hourIndex = now.getHours()
    const humidity = hourly?.relativehumidity_2m?.[hourIndex] ?? null
    const feelsLike = hourly?.apparent_temperature?.[hourIndex] ?? null

    const forecast = (daily?.time || []).slice(0, 5).map((date: string, i: number) => ({
      date,
      max: Math.round(daily.temperature_2m_max[i]),
      min: Math.round(daily.temperature_2m_min[i]),
      code: daily.weathercode[i],
      condition: WMO_CODES[daily.weathercode[i]]?.label || 'Unknown',
      icon: WMO_CODES[daily.weathercode[i]]?.icon || '🌡️',
      precipitation: Math.round((daily.precipitation_sum[i] || 0) * 10) / 10,
      sunrise: daily.sunrise?.[i],
      sunset: daily.sunset?.[i],
    }))

    return NextResponse.json({
      city: name,
      country,
      latitude,
      longitude,
      timezone,
      current: {
        temperature: Math.round(cw.temperature),
        feelsLike: feelsLike !== null ? Math.round(feelsLike) : null,
        condition: WMO_CODES[cw.weathercode]?.label || 'Unknown',
        icon: WMO_CODES[cw.weathercode]?.icon || '🌡️',
        code: cw.weathercode,
        windspeed: Math.round(cw.windspeed),
        winddirection: cw.winddirection,
        isDay: cw.is_day === 1,
        humidity,
      },
      forecast,
    })
  } catch (e) {
    return NextResponse.json({ error: 'Weather service unavailable' }, { status: 500 })
  }
}
