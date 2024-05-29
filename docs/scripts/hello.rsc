# RouterOS script to validate loading from GitHub
{
    :local msg "Hello from tikoci.github.io"
    /log info "$msg"
    :put "$msg"
    :return true 
}
