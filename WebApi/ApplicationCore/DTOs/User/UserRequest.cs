using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.User
{
    public class UserRequest
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public int RolId { get; set; }
    }
}
