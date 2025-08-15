import LoginForm from '../components/auth/LoginForm'

export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <LoginForm />
        <div className="text-sm mt-4 text-gray-600">
          Don’t have an account? <a href="/register" className="text-blue-600 underline">Register</a>
        </div>
      </div>
    </div>
  )
}