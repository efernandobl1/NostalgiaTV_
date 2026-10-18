namespace ApplicationCore.Exceptions;

/// <summary>The caller is signed in but the business rules do not allow this action.</summary>
public class ForbiddenException(string message) : Exception(message);
