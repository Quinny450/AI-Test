param(
  [int]$Port = 8080
)

$root = [System.IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

$mimeTypes = @{
  ".css" = "text/css; charset=utf-8"
  ".html" = "text/html; charset=utf-8"
  ".js" = "application/javascript; charset=utf-8"
  ".json" = "application/json; charset=utf-8"
  ".svg" = "image/svg+xml"
}

Write-Host "Serving $root at http://localhost:$Port/"
Write-Host "Press Ctrl+C to stop."

function Send-Response {
  param(
    [Parameter(Mandatory = $true)]
    [System.Net.Sockets.NetworkStream]$Stream,

    [Parameter(Mandatory = $true)]
    [int]$StatusCode,

    [Parameter(Mandatory = $true)]
    [string]$StatusText,

    [Parameter(Mandatory = $true)]
    [byte[]]$Body,

    [Parameter(Mandatory = $true)]
    [string]$ContentType
  )

  $header = (
    "HTTP/1.1 $StatusCode $StatusText`r`n" +
    "Content-Type: $ContentType`r`n" +
    "Content-Length: $($Body.Length)`r`n" +
    "Connection: close`r`n`r`n"
  )

  $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
  $Stream.Write($headerBytes, 0, $headerBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
  $Stream.Flush()
}

try {
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new(
        $stream,
        [System.Text.Encoding]::ASCII,
        $false,
        1024,
        $true
      )
      $requestLine = $reader.ReadLine()

      while ($reader.ReadLine() -ne "") {
        continue
      }

      if ([string]::IsNullOrWhiteSpace($requestLine)) {
        continue
      }

      $requestParts = $requestLine.Split(" ")
      $rawPath = if ($requestParts.Length -ge 2) {
        $requestParts[1]
      }
      else {
        "/"
      }

      $requestPath = [System.Uri]::UnescapeDataString(
        $rawPath.Split("?")[0].TrimStart([char[]]"/")
      )

      if ([string]::IsNullOrWhiteSpace($requestPath)) {
        $requestPath = "index.html"
      }

      $fullPath = [System.IO.Path]::GetFullPath((Join-Path $root $requestPath))

      if (
        -not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not (Test-Path -LiteralPath $fullPath -PathType Leaf)
      ) {
        $buffer = [System.Text.Encoding]::UTF8.GetBytes("Not found")
        Send-Response -Stream $stream -StatusCode 404 -StatusText "Not Found" -Body $buffer -ContentType "text/plain; charset=utf-8"
        continue
      }

      $extension = [System.IO.Path]::GetExtension($fullPath).ToLowerInvariant()
      $contentType = if ($mimeTypes.ContainsKey($extension)) {
        $mimeTypes[$extension]
      }
      else {
        "application/octet-stream"
      }

      $content = [System.IO.File]::ReadAllBytes($fullPath)
      Send-Response -Stream $stream -StatusCode 200 -StatusText "OK" -Body $content -ContentType $contentType
    }
    finally {
      if ($null -ne $client) {
        $client.Close()
      }
    }
  }
}
finally {
  $listener.Stop()
}
