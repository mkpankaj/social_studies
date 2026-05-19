import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const getChapters = () => api.get('/chapters').then(r => r.data)
export const getChapter = (id) => api.get(`/chapters/${id}`).then(r => r.data)
export const getQuiz = (id) => api.get(`/chapters/${id}/quiz`).then(r => r.data)
export const evaluateAnswer = (payload) => api.post('/quiz/evaluate', payload).then(r => r.data)
export const askAI = (payload) => api.post('/ask', payload).then(r => r.data)
export const pdfUrl = (id) => `/api/chapters/${id}/pdf`
export const getStatus = () => api.get('/status').then(r => r.data)
