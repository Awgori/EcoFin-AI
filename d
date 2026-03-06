<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>EcoFin - Verifying...</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <div class="login-wrapper">
        <div class="login-container" style="text-align:center;">
            <img src="images/shark-logo.png" alt="Logo" class="logo">
            <h1>EcoFin - AI</h1>
            <p id="statusMsg" style="font-size:15px; margin-top:20px;">Verifying your email...</p>
        </div>
    </div>

    <script>
        // Supabase puts the token in the URL hash fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);

        const error = params.get('error');
        const errorDesc = params.get('error_description');

        if (error) {
            document.getElementById('statusMsg').innerHTML =
                `<span style="color:red;">❌ ${errorDesc || 'Verification failed.'}</span><br><br>
                 <a href="/signup.html" style="color:#4CAF50;">Try signing up again</a>`;
        } else {
            // Success — redirect to login with verified flag
            document.getElementById('statusMsg').innerHTML = '✅ Email verified! Redirecting...';
            setTimeout(() => {
                window.location.href = '/login.html?verified=true';
            }, 1500);
        }
    </script>
</body>
</html>