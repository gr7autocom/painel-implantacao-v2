const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME as string
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET as string

export async function uploadImagemCloudinary(
  file: File,
  folder = 'tarefa-anexos'
): Promise<{ url: string; public_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string }
        resolve({ url: data.secure_url, public_id: data.public_id })
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: { message?: string } }
          reject(new Error(err?.error?.message ?? `Upload falhou: ${xhr.status}`))
        } catch {
          reject(new Error(`Upload falhou: ${xhr.status}`))
        }
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Erro de rede no upload')))
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)
    xhr.send(formData)
  })
}

export async function uploadImagemCloudinariaComProgresso(
  file: File,
  onProgress: (pct: number) => void,
  folder = 'tarefa-anexos'
): Promise<{ url: string; public_id: string }> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', UPLOAD_PRESET)
  formData.append('folder', folder)

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 90))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText) as { secure_url: string; public_id: string }
        onProgress(100)
        resolve({ url: data.secure_url, public_id: data.public_id })
      } else {
        reject(new Error(`Upload falhou: ${xhr.status}`))
      }
    })
    xhr.addEventListener('error', () => reject(new Error('Erro de rede no upload')))
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`)
    xhr.send(formData)
  })
}
