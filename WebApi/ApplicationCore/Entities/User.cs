using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.Entities
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; }
        public string PasswordHash { get; set; }

        public ICollection<RefreshToken> RefreshTokens { get; set; } = [];
        public int RolId { get; set; }
        public Rol Rol { get; set; } = null!;
    }
}
