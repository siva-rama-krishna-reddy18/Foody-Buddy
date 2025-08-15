import RegisterForm from '../components/auth/RegisterForm'

export default function Register() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md border rounded-lg p-6 shadow">
        <h1 className="text-xl font-semibold mb-4">Create account</h1>
        <RegisterForm />
        <div className="text-sm mt-4 text-gray-600">
          Already have an account? <a href="/login" className="text-blue-600 underline">Sign in</a>
        </div>
      </div>
    </div>
  )
}