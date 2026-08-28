using System;
using System.Collections.Generic;
using System.Text;

namespace ApplicationCore.DTOs.Auth
{
    public class RefreshTokenRequest
    {
        public string Token { get; set; } = string.Empty;
    }
}
