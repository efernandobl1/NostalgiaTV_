using ApplicationCore.DTOs.Rol;
using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.User
{
    public class UserResponse
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public RolResponse Rol { get; set; } = null!;
    }
}
