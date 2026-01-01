import { jsPDF } from 'jspdf'

export const exportToPNG = async (scoreDivRef) => {
  const canvas = scoreDivRef.current
  if (!canvas) return

  // 1. Отримуємо дані зображення
  const dataUrl = canvas.toDataURL('image/png', 1.0)

  // 2. Створюємо "невидиме" посилання для завантаження
  const link = document.createElement('a')
  link.href = dataUrl

  // Вказуємо назву файлу
  link.download = `guitar-tab-${Date.now()}.png`

  // 3. Симулюємо клік по посиланню
  document.body.appendChild(link)
  link.click()

  // Видаляємо тимчасовий елемент
  document.body.removeChild(link)
}

export const exportToPDF = async (scoreDivRef, title) => {
  const canvas = scoreDivRef.current
  if (!canvas) return

  await document.fonts.ready

  const imgData = canvas.toDataURL('image/png', 1.0)

  const orientation = canvas.width > canvas.height ? 'l' : 'p'
  const pdf = new jsPDF(orientation, 'px', [canvas.width, canvas.height])
  // Додаємо назву в PDF (шрифт, розмір, текст)
  pdf.setFontSize(20)
  pdf.text(title, canvas.width / 2, 20, { align: 'center' })

  pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)

  pdf.save(`guitar-tab-final.pdf`)
}
