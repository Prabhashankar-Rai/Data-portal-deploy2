export default function AccessDenied() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-full max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4 text-red-600">Access Denied</h1>
        <p className="text-gray-700">You do not have permission to access this page.</p>
        <p className="mt-4 text-sm text-gray-500">Please contact your administrator if you believe this is an error.</p>
      </div>
    </div>
  );
}