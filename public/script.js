import { ask, messages, speech as play_sound, speech } from './ai.js'

const widgetIframe = document.getElementById('sc-widget')
window.player = SC.Widget(widgetIframe)

const revibe_button = document.getElementById('revibe')
const remix_indicator = document.getElementById('remix-indicator')
const inner_container = document.getElementById('inner-container')

let started = false
let startTimeout = null
let pauseTimeout = null

inner_container.addEventListener('click', (e) => {
  if (e.target.id === 'revibe') return window.start_sequence()
  inner_container.style.visibility = 'hidden'
})

const unbind = () => {
  window.player.unbind(SC.Widget.Events.READY, window.player_ready)
  window.player.unbind(SC.Widget.Events.PLAY, window.player_play)
  window.player.unbind(SC.Widget.Events.PAUSE, window.player_pause)
  window.player.unbind(SC.Widget.Events.FINISH, window.player_finish)
}

window.player_ready = () => {
  console.log('player state: START')
  window.player.play()
}

window.player_play = () => {
  started = true
  if (!started) return

  clearTimeout(startTimeout)
  clearTimeout(pauseTimeout)
  startTimeout = setTimeout(() => {
    console.log('Player: PLAY')
    inner_container.style.visibility = 'hidden'
    window.obsstudio?.startRecording()
  }, 1000)
}

window.player_pause = () => {
  if (!started) return
  console.log('Player: PAUSE')
  clearTimeout(pauseTimeout)
  pauseTimeout = setTimeout(() => {
    window.obsstudio?.stopRecording()
    inner_container.style.visibility = 'visible'
  }, 3000)
}

window.player_finish = () => {
  console.log('Player: FINISH')
  window.obsstudio?.stopRecording()
  inner_container.style.visibility = 'visible'
  return revibe()
}

const rebind = () => {
  window.player.bind(SC.Widget.Events.READY, window.player_ready)
  window.player.bind(SC.Widget.Events.PLAY, window.player_play)
  window.player.bind(SC.Widget.Events.PAUSE, window.player_pause)
  window.player.bind(SC.Widget.Events.FINISH, window.player_finish)
}

rebind()

window.play_artist = async (url) => {
  unbind()
  await new Promise((callback) => {
    window.player.load(url, {
      auto_play: true,
      visual: true,
      show_comments: true,
      show_user: true,
      hide_related: true,
      show_reposts: true,
      callback: () => {
        window.innerHeight = 1280
        window.innerWidth = 720
        callback()
      }
    })
  })
  rebind()
}

window.play_sound = async (text) => {
  window.player.setVolume(30)
  const blob = await speech(text)
  return new Promise(async (res, rej) => {
    const audio = document.getElementById('control') // iOS quirk
    audio.src = URL.createObjectURL(blob)
    audio.controls = true
    audio.muted = false
    audio.style.display = 'none'
    document.body.appendChild(audio)
    audio.play()
    audio.addEventListener('ended', () => {
      // audio.remove() // iOS quirk
      window.player.setVolume(100)
      res()
    })
  })
}

window.start_sequence = async (e) => {
  if (revibe_button.disabled) return
  if (queue.length()) return revibe()

  revibe_button.disabled = true
  remix_indicator.innerHTML = '<p>Hello, I am a virtual DJ, let me play some music.</p>'
  await window.play_sound('Hello, I am a virtual DJ, let me play some music.')
  return revibe()
}

const history = {
  get: () => window.localStorage.getItem('history'),
  push: (name) => {
    const _history = history.get()
    if (!_history) window.localStorage.setItem('history', `${name}`)

    window.localStorage.setItem('history', `${name}, ${history.get()}`)
  }
}

const queue = {
  get: () => {
    const q = window.localStorage.getItem('queue')
    if (!q) return []

    try {
      const tracks = JSON.parse(q)
      return tracks
    } catch (e) {
      console.log('error retriving a queue')
      return []
    }
  },
  length: () => {
    const tracks = queue.get()
    return tracks.length
  },
  shift: () => {
    const tracks = queue.get()
    const track = tracks.shift()
    queue.set(tracks)
    return track
  },
  set: (tracks) => {
    window.localStorage.setItem('queue', JSON.stringify(tracks))
  }
}

let limiter = 0

const revibe = async () => {
  if (queue.length()) {
    const track = queue.shift()
    history.push(track.track)
    remix_indicator.innerHTML = `<p>${track.justification}</p>`
    window.obsstudio?.startRecording()
    await window.play_sound(track.justification)
    return window.play_artist(track.track)
  }

  remix_indicator.innerHTML = '<p>Hold on, lemme vibe it out!</p>'

  try {
    clearTimeout(limiter)
    limiter = setTimeout(async () => {

      const [res] = await Promise.all([
        ask(`
Find some songs from soundcloud for Star Wars Flashback Disco
like as if it was in older star wars, dont repeat previous tracks
Previous tracks: ${history.get()}
Example justifications:
- Up next is "Artist Name" because...
- Moving to our next pick is "Artist Name" because...
- Finally our last pick is "Artist Name" because...
Respond with json object:
{
  "tracks": [{
      "justification": "Why this track", 
      "track": "https://api.soundcloud.com/tracks/13692671"
  }]
}
and nothing else.`),
        window.play_sound('Hold on, lemme vibe it out!')
      ])
      const payload = JSON.parse(res.output[2].content[0].text)
      payload.tracks.map(track => console.log(`${track.justification}`))
      queue.set(payload.tracks)

      revibe_button.disabled = false
      return revibe()
    }, 3000)
  } catch (e) {
    await window.play_sound('Could not start bro, lets try one more time!')
    revibe_button.disabled = false
    return revibe()
  }
}
