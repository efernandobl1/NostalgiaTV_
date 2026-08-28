using ApplicationCore.DTOs.Menu;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Rol
{
    public class RolResponse
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public List<int> MenuIds { get; set; } = [];
    }
}
