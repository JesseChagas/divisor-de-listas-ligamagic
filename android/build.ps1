param([string]$Sdk="$env:LOCALAPPDATA\Android\Sdk",[string]$Java="C:\Program Files\Java\jdk-17",[string]$BuildTools="35.0.1")
$ErrorActionPreference='Stop'
$project=$PSScriptRoot
$build=Join-Path $project 'build'
$bt=Join-Path $Sdk "build-tools\$BuildTools"
$android=Join-Path $Sdk 'platforms\android-35\android.jar'
$env:JAVA_HOME=$Java
New-Item -ItemType Directory -Force $build,"$build\classes","$build\dex" | Out-Null
function Checked {param([string]$Exe,[string[]]$Arguments) & $Exe @Arguments; if($LASTEXITCODE -ne 0){throw "Falha em $Exe ($LASTEXITCODE)"}}
Checked "$bt\aapt2.exe" @('compile','--dir',"$project\res",'-o',"$build\resources.zip")
Checked "$bt\aapt2.exe" @('link','-o',"$build\base.apk",'-I',$android,'--manifest',"$project\AndroidManifest.xml","$build\resources.zip",'--auto-add-overlay')
$sources=Get-ChildItem "$project\src" -Recurse -Filter *.java | ForEach-Object {$_.FullName}
Checked "$Java\bin\javac.exe" (@('-encoding','UTF-8','-source','8','-target','8','-classpath',$android,'-d',"$build\classes")+$sources)
Checked "$Java\bin\jar.exe" @('cf',"$build\classes.jar",'-C',"$build\classes",'.')
Checked "$bt\d8.bat" @('--lib',$android,'--min-api','26','--output',"$build\dex","$build\classes.jar")
Copy-Item "$build\base.apk" "$build\unsigned.apk" -Force
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive=[System.IO.Compression.ZipFile]::Open("$build\unsigned.apk",[System.IO.Compression.ZipArchiveMode]::Update)
try{
 [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,"$build\dex\classes.dex",'classes.dex') | Out-Null
 $assetRoot=Join-Path $project 'assets'
 foreach($assetFile in (Get-ChildItem -LiteralPath $assetRoot -Recurse -File)){
  $entryName='assets/'+$assetFile.FullName.Substring($assetRoot.Length+1).Replace('\','/')
  [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,$assetFile.FullName,$entryName) | Out-Null
 }
}finally{$archive.Dispose()}
Checked "$bt\zipalign.exe" @('-f','-p','4',"$build\unsigned.apk","$build\aligned.apk")
$key=Join-Path $env:USERPROFILE '.android\debug.keystore'
if(!(Test-Path -LiteralPath $key)){throw 'Chave de desenvolvimento Android ausente. Crie debug.keystore antes de assinar.'}
Checked "$bt\apksigner.bat" @('sign','--ks',$key,'--ks-key-alias','androiddebugkey','--ks-pass','pass:android','--key-pass','pass:android','--out',"$project\Liga-Divisor-1.1.0.apk","$build\aligned.apk")
Checked "$bt\apksigner.bat" @('verify','--verbose',"$project\Liga-Divisor-1.1.0.apk")
Write-Output "APK pronto: $project\Liga-Divisor-1.1.0.apk"

