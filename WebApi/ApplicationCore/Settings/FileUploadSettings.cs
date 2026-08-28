using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Settings
{
    public class FileUploadSettings
    {
        public int MaxFileSizeMB { get; set; }
        public List<string> AllowedExtensions { get; set; } = [];
    }
}
