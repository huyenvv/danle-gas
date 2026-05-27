require('@testing-library/jest-dom')

beforeEach(() => {
  localStorage.clear()
  window.__INITIAL_DATA__ = null
  window.__SSO_TOKEN__ = undefined
  window.__SSO_PARENT__ = undefined
})
