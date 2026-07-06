using Microsoft.AspNetCore.Mvc;
using TaskBoard.Server.Data;
using TaskBoard.Server.Models;

namespace TaskBoard.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UsersController : ControllerBase
    {
        private readonly IUserRepository _repository;

        public UsersController(IUserRepository repository)
        {
            _repository = repository;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(Guid id)
        {
            var user = await _repository.GetByIdAsync(id);
            if (user is null) return NotFound();
            return Ok(user);
        }

        [HttpGet("by-email")]
        public async Task<IActionResult> GetByEmail([FromQuery] string email)
        {
            var user = await _repository.GetByEmailAsync(email);
            if (user is null) return NotFound();
            return Ok(user);
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest request)
        {
            await _repository.CreateAsync(request);
            var created = await _repository.GetByIdAsync(request.Id);
            return CreatedAtAction(nameof(GetById), new { id = request.Id }, created);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(Guid id, [FromBody] UpdateUserRequest request)
        {
            var success = await _repository.UpdateAsync(id, request);
            if (!success) return NotFound();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(Guid id)
        {
            var success = await _repository.DeleteAsync(id);
            if (!success) return NotFound();
            return NoContent();
        }
    }
}