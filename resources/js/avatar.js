// Choix et ajustement de la photo de profil (page Profil)
const picker = document.querySelector('[data-avatar-picker]')

if (picker) {
  const STAGE = 260 // taille du cercle d'ajustement, en pixels
  const OUTPUT = 512 // taille de la photo enregistrée
  const MAX_ORIGINAL = 15 * 1024 * 1024

  const openButton = picker.querySelector('[data-avatar-open]')
  const fileInput = picker.querySelector('[data-avatar-input]')
  const finalInput = picker.querySelector('[data-avatar-final]')
  const form = finalInput.closest('form')
  const modal = picker.querySelector('[data-cropper]')
  const stage = modal.querySelector('[data-cropper-stage]')
  const image = modal.querySelector('[data-cropper-img]')
  const slider = modal.querySelector('[data-cropper-zoom]')
  const cancelButton = modal.querySelector('[data-cropper-cancel]')
  const saveButton = modal.querySelector('[data-cropper-save]')

  let objectUrl = null
  let base = 1
  let zoom = 1
  let x = 0
  let y = 0
  let drag = null

  const scale = () => base * zoom

  // Garde l'image toujours au moins aussi grande que le cercle
  const clamp = () => {
    x = Math.min(0, Math.max(STAGE - image.naturalWidth * scale(), x))
    y = Math.min(0, Math.max(STAGE - image.naturalHeight * scale(), y))
  }

  const render = () => {
    clamp()
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale()})`
  }

  // Zoom en gardant le centre du cercle fixe
  const setZoom = (value) => {
    const oldScale = scale()
    const cx = (STAGE / 2 - x) / oldScale
    const cy = (STAGE / 2 - y) / oldScale
    zoom = Math.min(3, Math.max(1, value))
    slider.value = String(zoom)
    x = STAGE / 2 - cx * scale()
    y = STAGE / 2 - cy * scale()
    render()
  }

  const close = () => {
    modal.hidden = true
    fileInput.value = ''
    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }

  openButton.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0]
    if (!file) return

    if (file.size > MAX_ORIGINAL) {
      alert('Cette image est trop lourde (15 Mo maximum).')
      fileInput.value = ''
      return
    }

    if (objectUrl) URL.revokeObjectURL(objectUrl)
    objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      base = STAGE / Math.min(image.naturalWidth, image.naturalHeight)
      zoom = 1
      slider.value = '1'
      x = (STAGE - image.naturalWidth * base) / 2
      y = (STAGE - image.naturalHeight * base) / 2
      render()
      modal.hidden = false
    }
    image.src = objectUrl
  })

  slider.addEventListener('input', () => setZoom(Number(slider.value)))

  // Glisser pour déplacer la photo
  stage.addEventListener('pointerdown', (event) => {
    stage.setPointerCapture(event.pointerId)
    drag = { startX: event.clientX, startY: event.clientY, x, y }
  })
  stage.addEventListener('pointermove', (event) => {
    if (!drag) return
    x = drag.x + (event.clientX - drag.startX)
    y = drag.y + (event.clientY - drag.startY)
    render()
  })
  const endDrag = () => {
    drag = null
  }
  stage.addEventListener('pointerup', endDrag)
  stage.addEventListener('pointercancel', endDrag)

  // Molette de la souris pour zoomer
  stage.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      setZoom(zoom - event.deltaY * 0.0015)
    },
    { passive: false }
  )

  cancelButton.addEventListener('click', close)
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal.hidden) close()
  })

  // Recadre la partie visible, puis envoie le formulaire
  saveButton.addEventListener('click', () => {
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const context = canvas.getContext('2d')

    const sx = -x / scale()
    const sy = -y / scale()
    const size = STAGE / scale()
    context.drawImage(image, sx, sy, size, size, 0, 0, OUTPUT, OUTPUT)

    saveButton.disabled = true
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          saveButton.disabled = false
          alert("Impossible de préparer l'image.")
          return
        }
        const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
        const transfer = new DataTransfer()
        transfer.items.add(file)
        finalInput.files = transfer.files
        form.submit()
      },
      'image/jpeg',
      0.9
    )
  })
}