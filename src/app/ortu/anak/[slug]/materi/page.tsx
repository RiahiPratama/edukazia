export default async function OrtuMateriPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const { slug } = await params;
  
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm p-12 max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">TEST PAGE WORKS!</h1>
        <p className="text-gray-600">Student Slug: {slug}</p>
        <p className="text-sm text-gray-500 mt-4">
          If you see this, the route is working!
        </p>
      </div>
    </div>
  );
}
