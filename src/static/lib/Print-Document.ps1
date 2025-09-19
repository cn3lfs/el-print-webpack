param (
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string]$FilePath,
  [string]$PrinterName,
  [string]$PageRange,
  [int]$Copies = 1
)

function Write-Log {
  param (
    [string]$Message,
    [string]$Level = "INFO"
  )
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "[$timestamp] [$Level] $Message"
}

function Set-DefaultPrinter {
  param ([string]$Name)
  try {
    $printers = Get-CimInstance Win32_Printer
    $target = $printers | Where-Object { $_.Name -eq $Name }
    if ($target) {
      $target.Default = $true
      $target.Put()
      Write-Log "Default printer set to: $Name"
    } else {
      Write-Log "Printer not found: $Name" "WARN"
    }
  } catch {
    Write-Log "Failed to set default printer: $_" "ERROR"
  }
}

function Get-WordApp {
  try {
    return New-Object -ComObject "Word.Application"
  } catch {
    Write-Log "Microsoft Word not available, trying WPS Word..." "WARN"
    try {
      return New-Object -ComObject "KWPS.Application"
    } catch {
      Write-Log "WPS Word also not available." "ERROR"
      return $null
    }
  }
}

function Get-ExcelApp {
  try {
    return New-Object -ComObject "Excel.Application"
  } catch {
    Write-Log "Microsoft Excel not available, trying WPS Excel..." "WARN"
    try {
      return New-Object -ComObject "KET.Application"
    } catch {
      Write-Log "WPS Excel also not available." "ERROR"
      return $null
    }
  }
}

function Get-PPTApp {
  try {
    return New-Object -ComObject "PowerPoint.Application"
  } catch {
    Write-Log "Microsoft PowerPoint not available, trying WPS PPT..." "WARN"
    try {
      return New-Object -ComObject "KWPP.Application"
    } catch {
      Write-Log "WPS PPT also not available." "ERROR"
      return $null
    }
  }
}

function Print-Word {
  param ([string]$Path)
  $word = Get-WordApp
  if (-not $word) { return }

  try {
    $word.Visible = $false
    $doc = $word.Documents.Open($Path, $false, $true)
    # 等待Word完成渲染，避免直接调用PrintOut()导致打印失败
    Write-Log "Waiting for Word to render presentation..." "INFO"
    Start-Sleep -Seconds 2
    $missing = [System.Reflection.Missing]::Value
    $doc.PrintOut(
      $missing, $missing, $missing, $missing, $missing,
      $missing, $missing, $Copies, $PageRange
    )
    $doc.Close($false)
    $word.Quit()
    Write-Log "Printed Word: $Path"
  } catch {
    Write-Log "Word print failed: $_" "ERROR"
  }
}

function Print-Excel {
  param ([string]$Path)
  $excel = Get-ExcelApp
  if (-not $excel) { return }

  try {
    $excel.Visible = $false
    $workbook = $excel.Workbooks.Open($Path)
    # 等待Excel完成渲染，避免直接调用PrintOut()导致打印失败
    Write-Log "Waiting for Excel to render presentation..." "INFO"
    Start-Sleep -Seconds 2
    $missing = [System.Reflection.Missing]::Value
    $workbook.PrintOut(
      $missing, $missing, $Copies, $missing,
      $missing, $missing, $missing, $missing
    )
    $workbook.Close($false)
    $excel.Quit()
    Write-Log "Printed Excel: $Path"
  } catch {
    Write-Log "Excel print failed: $_" "ERROR"
  }
}

function Print-PPT {
  param ([string]$Path)

  $ppt = Get-PPTApp
  if (-not $ppt) { return }

  try {
    $presentation = $ppt.Presentations.Open($Path)

    # 等待PowerPoint完成渲染，避免直接调用PrintOut()导致打印失败
    Write-Log "Waiting for PowerPoint to render presentation..." "INFO"
    Start-Sleep -Seconds 2

    # 设置打印选项
    $presentation.PrintOptions.NumberOfCopies = $Copies

    # Simple print without complex options
    $presentation.PrintOut()

    $presentation.Close()
    $ppt.Quit()
    Write-Log "Printed PPT: $Path"
  } catch {
    Write-Log "PPT print failed: $_" "ERROR"
  }
}


function Dispatch-Print {
  param ([string]$Path)
  $ext = [System.IO.Path]::GetExtension($Path).ToLower()
  switch ($ext) {
    ".docx" { Print-Word $Path }
    ".doc"  { Print-Word $Path }
    ".xlsx" { Print-Excel $Path }
    ".xls"  { Print-Excel $Path }
    ".pptx" { Print-PPT $Path }
    ".ppt"  { Print-PPT $Path }
    default { Write-Log "Unsupported file type: $Path" "WARN" }
  }
}

function Print-Folder {
  param ([string]$FolderPath)
  $files = Get-ChildItem -Path $FolderPath -Recurse -Include *.docx, *.doc, *.xlsx, *.xls, *.pptx, *.ppt
  foreach ($file in $files) {
    Dispatch-Print $file.FullName
  }
}

function Start-PrintJob {
  param ([string]$TargetPath)

  if ([string]::IsNullOrWhiteSpace($TargetPath)) {
    Write-Log "Target path is empty or null" "ERROR"
    return
  }

  if ($PrinterName) {
    Set-DefaultPrinter -Name $PrinterName
  }

  if (Test-Path $TargetPath) {
    $attr = Get-Item $TargetPath
    if ($attr.PSIsContainer) {
      Print-Folder $TargetPath
    } else {
      Dispatch-Print $TargetPath
    }
  } else {
    Write-Log "Path not found: $TargetPath" "ERROR"
  }
}

Start-PrintJob -TargetPath $FilePath