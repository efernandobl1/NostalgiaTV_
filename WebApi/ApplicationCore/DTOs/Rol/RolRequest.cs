using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Rol
{
    public class RolRequest
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<int> MenuIds { get; set; } = [];
    }
}
